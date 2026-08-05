import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Carpeta en la papelera. `contains` dice que se lleva consigo al restaurar. */
export interface TrashCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  deletedAt: Date;
  contains: { categories: number; documents: number };
}

/** Documento en la papelera. Sin contenido: solo lo que hace falta para listarlo. */
export interface TrashDocument {
  id: string;
  title: string;
  deletedAt: Date;
}

export interface TrashResult {
  categories: TrashCategory[];
  documents: TrashDocument[];
}

/** Fila minima de categoria con la que se recorren los arboles de la papelera. */
const nodeSelect = {
  id: true,
  parentId: true,
  deletedAt: true,
} satisfies Prisma.CategorySelect;

type CategoryNodeRow = Prisma.CategoryGetPayload<{ select: typeof nodeSelect }>;

@Injectable()
export class TrashService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Contenido de la papelera, de lo mas reciente a lo mas antiguo.
   *
   * NORMA: solo se listan **las raices de cada borrado**, no todo lo que
   * arrastro. Al enviar a la papelera una carpeta con 10 subcarpetas se ve una
   * entrada, no once: las demas se restauran con ella. Lo mismo con sus
   * documentos. Un elemento es raiz cuando su contenedor no esta en la
   * papelera con el MISMO `deletedAt`, que es lo que identifica el lote.
   */
  async list(ownerId: string): Promise<TrashResult> {
    const [cats, docs] = await Promise.all([
      this.prisma.category.findMany({
        where: { ownerId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: { ...nodeSelect, name: true, icon: true, color: true },
      }),
      this.prisma.document.findMany({
        where: { ownerId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: { id: true, title: true, categoryId: true, deletedAt: true },
      }),
    ]);

    // Un lote se identifica por "id de carpeta + instante de borrado".
    const batchKey = (id: string, deletedAt: Date | null) => `${id}@${deletedAt?.getTime()}`;
    const deletedCats = new Set(cats.map((cat) => batchKey(cat.id, cat.deletedAt)));

    const rootCats = cats.filter((cat) => !deletedCats.has(batchKey(cat.parentId ?? '', cat.deletedAt)));
    const rootDocs = docs.filter(
      (doc) => !deletedCats.has(batchKey(doc.categoryId ?? '', doc.deletedAt)),
    );

    // Que arrastra cada carpeta raiz, para poder avisar antes de restaurar o
    // de borrar definitivamente.
    const categories = rootCats.map((cat) => {
      const subtree = this.batchSubtree(cats, cat.id, cat.deletedAt);
      const documents = docs.filter(
        (doc) =>
          doc.categoryId !== null &&
          subtree.has(doc.categoryId) &&
          doc.deletedAt?.getTime() === cat.deletedAt?.getTime(),
      );
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        deletedAt: cat.deletedAt as Date,
        // El subarbol se cuenta sin la propia carpeta.
        contains: { categories: subtree.size - 1, documents: documents.length },
      };
    });

    return {
      categories,
      documents: rootDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        deletedAt: doc.deletedAt as Date,
      })),
    };
  }

  /**
   * Saca el documento de la papelera. Si su carpeta ya no existe o sigue
   * borrada, vuelve a la raiz: un documento restaurado siempre tiene que
   * quedar en algun sitio al que se pueda llegar navegando.
   */
  async restoreDocument(ownerId: string, id: string): Promise<{ restored: number }> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: { not: null } },
      select: { id: true, categoryId: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado en la papelera');
    }
    const categoryId = (await this.isAlive(ownerId, doc.categoryId)) ? doc.categoryId : null;
    await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        deletedAt: null,
        categoryId,
        position: await this.nextDocumentPosition(ownerId, categoryId),
      },
    });
    return { restored: 1 };
  }

  /**
   * Saca de la papelera la carpeta **y todo lo que se borro con ella** (su
   * subarbol y sus documentos, los del mismo lote). Si su carpeta padre sigue
   * borrada, la restaurada pasa a colgar de la raiz.
   */
  async restoreCategory(ownerId: string, id: string): Promise<{ restored: number }> {
    const cat = await this.prisma.category.findFirst({
      where: { id, ownerId, deletedAt: { not: null } },
      select: nodeSelect,
    });
    if (!cat) {
      throw new NotFoundException('Carpeta no encontrada en la papelera');
    }

    const trashed = await this.prisma.category.findMany({
      where: { ownerId, deletedAt: { not: null } },
      select: nodeSelect,
    });
    const subtree = [...this.batchSubtree(trashed, cat.id, cat.deletedAt)];
    const parentId = (await this.isAlive(ownerId, cat.parentId)) ? cat.parentId : null;
    const position = await this.nextCategoryPosition(ownerId, parentId);

    const [cats, docs] = await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { id: { in: subtree }, ownerId },
        data: { deletedAt: null },
      }),
      this.prisma.document.updateMany({
        where: { categoryId: { in: subtree }, ownerId, deletedAt: cat.deletedAt },
        data: { deletedAt: null },
      }),
      // La carpeta restaurada se recoloca: al final de su nivel, y en la raiz
      // si su padre ya no esta vivo.
      this.prisma.category.update({ where: { id: cat.id }, data: { parentId, position } }),
    ]);
    return { restored: cats.count + docs.count };
  }

  /** Borra el documento de verdad. No hay vuelta atras. */
  async purgeDocument(ownerId: string, id: string): Promise<{ purged: number }> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado en la papelera');
    }
    await this.prisma.document.delete({ where: { id: doc.id } });
    return { purged: 1 };
  }

  /**
   * Borra de verdad la carpeta, su subarbol del mismo lote y los documentos
   * que haya dentro **que esten en la papelera**.
   *
   * NORMA: un documento vivo dentro de ese subarbol no se destruye nunca; cae
   * a la raiz. Hoy no deberia haber ninguno —`categories.remove()` se los
   * lleva a la papelera con la carpeta—, pero destruir contenido vivo por un
   * dato inconsistente seria irreversible.
   */
  async purgeCategory(ownerId: string, id: string): Promise<{ purged: number }> {
    const cat = await this.prisma.category.findFirst({
      where: { id, ownerId, deletedAt: { not: null } },
      select: nodeSelect,
    });
    if (!cat) {
      throw new NotFoundException('Carpeta no encontrada en la papelera');
    }

    const trashed = await this.prisma.category.findMany({
      where: { ownerId, deletedAt: { not: null } },
      select: nodeSelect,
    });
    const subtree = [...this.batchSubtree(trashed, cat.id, cat.deletedAt)];

    const [docs, cats] = await this.prisma.$transaction([
      this.prisma.document.deleteMany({
        where: { categoryId: { in: subtree }, ownerId, deletedAt: { not: null } },
      }),
      this.prisma.category.deleteMany({ where: { id: { in: subtree }, ownerId } }),
    ]);
    return { purged: docs.count + cats.count };
  }

  /** Vacia la papelera entera del usuario. */
  async empty(ownerId: string): Promise<{ purged: number }> {
    const [docs, cats] = await this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { ownerId, deletedAt: { not: null } } }),
      this.prisma.category.deleteMany({ where: { ownerId, deletedAt: { not: null } } }),
    ]);
    return { purged: docs.count + cats.count };
  }

  /**
   * Borra definitivamente lo que lleve mas de `days` dias en la papelera, de
   * TODOS los usuarios. Lo llama la tarea programada; devuelve el recuento
   * para poder loguearlo.
   */
  async purgeOlderThan(days: number): Promise<{ purged: number }> {
    const limit = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [docs, cats] = await this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { deletedAt: { lt: limit } } }),
      this.prisma.category.deleteMany({ where: { deletedAt: { lt: limit } } }),
    ]);
    return { purged: docs.count + cats.count };
  }

  // ---------------- helpers ----------------

  /**
   * Ids de `rootId` y sus descendientes **dentro del mismo lote de borrado**:
   * se recorre solo por hijas que compartan `deletedAt` con la raiz. Una
   * subcarpeta que ya estaba en la papelera de antes no entra, porque no se
   * borro con esta y no debe restaurarse con ella.
   */
  private batchSubtree(all: CategoryNodeRow[], rootId: string, deletedAt: Date | null): Set<string> {
    const stamp = deletedAt?.getTime();
    const childrenByParent = new Map<string, string[]>();
    for (const cat of all) {
      if (cat.parentId === null || cat.deletedAt?.getTime() !== stamp) {
        continue;
      }
      const list = childrenByParent.get(cat.parentId) ?? [];
      list.push(cat.id);
      childrenByParent.set(cat.parentId, list);
    }
    const result = new Set<string>([rootId]);
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const childId of childrenByParent.get(current) ?? []) {
        if (!result.has(childId)) {
          result.add(childId);
          stack.push(childId);
        }
      }
    }
    return result;
  }

  /** true si esa carpeta existe y NO esta en la papelera. `null` = la raiz. */
  private async isAlive(ownerId: string, categoryId: string | null): Promise<boolean> {
    if (categoryId === null) {
      return false;
    }
    const cat = await this.prisma.category.findFirst({
      where: { id: categoryId, ownerId, deletedAt: null },
      select: { id: true },
    });
    return cat !== null;
  }

  private async nextCategoryPosition(ownerId: string, parentId: string | null): Promise<number> {
    const last = await this.prisma.category.findFirst({
      where: { ownerId, parentId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }

  private async nextDocumentPosition(ownerId: string, categoryId: string | null): Promise<number> {
    const last = await this.prisma.document.findFirst({
      where: { ownerId, categoryId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }
}
