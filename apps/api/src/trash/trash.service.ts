import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrashBatchDto } from './dto/trash-batch.dto';

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
  /** Dias que algo aguanta aqui antes de la purga automatica. */
  retentionDays: number;
}

/** Dias por defecto en la papelera si el .env no dice otra cosa. */
const DEFAULT_RETENTION_DAYS = 30;

/** Fila minima de categoria con la que se recorren los arboles de la papelera. */
const nodeSelect = {
  id: true,
  parentId: true,
  deletedAt: true,
} satisfies Prisma.CategorySelect;

type CategoryNodeRow = Prisma.CategoryGetPayload<{ select: typeof nodeSelect }>;

@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Dias que algo aguanta en la papelera. Sale del `.env`; un valor no valido
   * o <= 0 cae al default. Lo consultan la tarea de purga y el listado, que lo
   * devuelve para que la UI pueda decir el plazo sin duplicar el numero.
   */
  retentionDays(): number {
    const raw = Number(this.config.get<string>('TRASH_RETENTION_DAYS'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
  }

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
      retentionDays: this.retentionDays(),
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

  /**
   * Restaura una seleccion entera **en una sola peticion y una sola
   * transaccion**. Hace lo mismo que llamar N veces a `restoreDocument` /
   * `restoreCategory`, pero sin N viajes de ida y vuelta.
   *
   * Los metodos de un elemento siguen existiendo: para uno solo son mas
   * baratos, porque no cargan la papelera entera para calcular los lotes.
   */
  async restoreMany(ownerId: string, dto: TrashBatchDto): Promise<{ restored: number }> {
    const { documentIds, categoryIds } = this.parseSelection(dto);

    const [docs, trashedCats] = await Promise.all([
      this.trashedDocuments(ownerId, documentIds),
      this.prisma.category.findMany({
        where: { ownerId, deletedAt: { not: null } },
        select: nodeSelect,
      }),
    ]);
    const roots = trashedCats.filter((cat) => categoryIds.includes(cat.id));
    if (roots.length !== categoryIds.length) {
      throw new NotFoundException('Alguna carpeta ya no está en la papelera');
    }

    // Cada carpeta seleccionada arrastra su lote; los subarboles pueden
    // solaparse (seleccionar una carpeta y una nieta suya), y el Set los une.
    const subtreeByRoot = new Map(
      roots.map((cat) => [cat.id, this.batchSubtree(trashedCats, cat.id, cat.deletedAt)]),
    );
    const restoredCats = new Set<string>();
    for (const subtree of subtreeByRoot.values()) {
      for (const id of subtree) {
        restoredCats.add(id);
      }
    }
    // Solo se recolocan las carpetas que no cuelgan de otra seleccionada: las
    // demas vuelven en su sitio, colgando de la que las contiene.
    const topRoots = roots.filter(
      (cat) => !roots.some((other) => other.id !== cat.id && subtreeByRoot.get(other.id)?.has(cat.id)),
    );

    // Un contenedor vale si sigue vivo o si se esta restaurando ahora mismo.
    const alive = await this.aliveCategoryIds(ownerId, [
      ...topRoots.map((cat) => cat.parentId),
      ...docs.map((doc) => doc.categoryId),
    ]);
    const survives = (id: string | null) => id !== null && (alive.has(id) || restoredCats.has(id));

    const catPosition = await this.positioner(ownerId, 'category');
    const docPosition = await this.positioner(ownerId, 'document');
    // Destino definitivo de cada elemento que hay que recolocar, calculado
    // fuera de la transaccion para no alargarla con consultas de posicion.
    //
    // Va en SERIE, no con Promise.all: el asignador de posiciones lleva un
    // contador por destino, y en paralelo dos elementos del mismo destino leen
    // el contador antes de que ninguno lo haya subido y acaban en la misma
    // posicion.
    const catMoves: { id: string; parentId: string | null; position: number }[] = [];
    for (const cat of topRoots) {
      const parentId = survives(cat.parentId) ? cat.parentId : null;
      catMoves.push({ id: cat.id, parentId, position: await catPosition(parentId) });
    }
    const docMoves: { id: string; categoryId: string | null; position: number }[] = [];
    for (const doc of docs) {
      const categoryId = survives(doc.categoryId) ? doc.categoryId : null;
      docMoves.push({ id: doc.id, categoryId, position: await docPosition(categoryId) });
    }

    return this.prisma.$transaction(async (tx) => {
      const cats = await tx.category.updateMany({
        where: { id: { in: [...restoredCats] }, ownerId },
        data: { deletedAt: null },
      });
      // Los documentos de cada lote se sacan por separado: cada carpeta
      // seleccionada tiene su propio instante de borrado.
      let batchDocs = 0;
      for (const cat of roots) {
        const { count } = await tx.document.updateMany({
          where: {
            categoryId: { in: [...(subtreeByRoot.get(cat.id) ?? [])] },
            ownerId,
            deletedAt: cat.deletedAt,
          },
          data: { deletedAt: null },
        });
        batchDocs += count;
      }
      for (const move of catMoves) {
        await tx.category.update({
          where: { id: move.id },
          data: { parentId: move.parentId, position: move.position },
        });
      }
      for (const move of docMoves) {
        await tx.document.update({
          where: { id: move.id },
          data: { deletedAt: null, categoryId: move.categoryId, position: move.position },
        });
      }
      // Las recolocaciones no suman: esas carpetas ya iban en `cats`.
      return { restored: cats.count + batchDocs + docMoves.length };
    });
  }

  /** Borra definitivamente una seleccion entera, en una sola transaccion. */
  async purgeMany(ownerId: string, dto: TrashBatchDto): Promise<{ purged: number }> {
    const { documentIds, categoryIds } = this.parseSelection(dto);

    const [, trashedCats] = await Promise.all([
      this.trashedDocuments(ownerId, documentIds),
      this.prisma.category.findMany({
        where: { ownerId, deletedAt: { not: null } },
        select: nodeSelect,
      }),
    ]);
    const roots = trashedCats.filter((cat) => categoryIds.includes(cat.id));
    if (roots.length !== categoryIds.length) {
      throw new NotFoundException('Alguna carpeta ya no está en la papelera');
    }

    const subtree = new Set<string>();
    for (const cat of roots) {
      for (const id of this.batchSubtree(trashedCats, cat.id, cat.deletedAt)) {
        subtree.add(id);
      }
    }
    const categoryList = [...subtree];

    const [docs, cats] = await this.prisma.$transaction([
      this.prisma.document.deleteMany({
        where: {
          ownerId,
          deletedAt: { not: null },
          OR: [{ id: { in: documentIds } }, { categoryId: { in: categoryList } }],
        },
      }),
      this.prisma.category.deleteMany({ where: { id: { in: categoryList }, ownerId } }),
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

  /** Ids unicos y no vacios. La seleccion vacia es un 400, no un no-op. */
  private parseSelection(dto: TrashBatchDto): { documentIds: string[]; categoryIds: string[] } {
    const documentIds = [...new Set(dto.documentIds ?? [])];
    const categoryIds = [...new Set(dto.categoryIds ?? [])];
    if (documentIds.length === 0 && categoryIds.length === 0) {
      throw new BadRequestException('Hay que indicar al menos un documento o una carpeta');
    }
    return { documentIds, categoryIds };
  }

  /**
   * Carga los documentos pedidos exigiendo que **todos** esten en la papelera y
   * sean del usuario. Es estricto a proposito, como el `reorder` de categorias:
   * una seleccion a medias significa que la pantalla esta desactualizada, y
   * vale mas decirlo que aplicar la mitad.
   */
  private async trashedDocuments(ownerId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const docs = await this.prisma.document.findMany({
      where: { id: { in: ids }, ownerId, deletedAt: { not: null } },
      select: { id: true, categoryId: true },
    });
    if (docs.length !== ids.length) {
      throw new NotFoundException('Algún documento ya no está en la papelera');
    }
    return docs;
  }

  /** De una lista de ids (con nulos y repetidos), los que son carpetas vivas. */
  private async aliveCategoryIds(
    ownerId: string,
    candidates: (string | null)[],
  ): Promise<Set<string>> {
    const ids = [...new Set(candidates.filter((id): id is string => id !== null))];
    if (ids.length === 0) {
      return new Set();
    }
    const cats = await this.prisma.category.findMany({
      where: { id: { in: ids }, ownerId, deletedAt: null },
      select: { id: true },
    });
    return new Set(cats.map((cat) => cat.id));
  }

  /**
   * Devuelve una funcion que da la siguiente posicion libre de un destino y va
   * incrementando: restaurar cinco documentos a la raiz los deja en posiciones
   * consecutivas, no todos en la misma. Consulta la BD una vez por destino.
   */
  private async positioner(ownerId: string, kind: 'category' | 'document') {
    const next = new Map<string, number>();
    return async (destination: string | null): Promise<number> => {
      const key = destination ?? 'root';
      if (!next.has(key)) {
        const last =
          kind === 'category'
            ? await this.prisma.category.findFirst({
                where: { ownerId, parentId: destination, deletedAt: null },
                orderBy: { position: 'desc' },
                select: { position: true },
              })
            : await this.prisma.document.findFirst({
                where: { ownerId, categoryId: destination, deletedAt: null },
                orderBy: { position: 'desc' },
                select: { position: true },
              });
        next.set(key, last ? last.position + 1 : 0);
      }
      const position = next.get(key) as number;
      next.set(key, position + 1);
      return position;
    };
  }

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
