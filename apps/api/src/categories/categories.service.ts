import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { TreeMode } from './dto/tree-mode.enum';
import { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryNode {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  parentId: string | null;
  /** Documentos directos de esta carpeta (sin contar los de sus subcarpetas). */
  documentCount: number;
  children: CategoryNode[];
}

/** Arbol de carpetas + documentos sueltos en la raiz. */
export interface CategoryTreeResult {
  tree: CategoryNode[];
  /** Documentos que viven en la raiz (fuera de cualquier carpeta). */
  rootDocumentCount: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      await this.assertOwned(ownerId, dto.parentId);
    }
    const position = await this.nextPosition(ownerId, dto.parentId ?? null);
    return this.prisma.category.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        position,
        ownerId,
      },
    });
  }

  /**
   * Arbol de carpetas del usuario con el numero de documentos de cada una.
   * El contador permite al front saber si una carpeta tiene contenido sin
   * cargar sus documentos: estos se piden solo al expandirla.
   */
  async tree(ownerId: string): Promise<CategoryTreeResult> {
    const [cats, counts] = await Promise.all([
      this.prisma.category.findMany({
        where: { ownerId, deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      // Una sola consulta agrupada: documentos vivos por carpeta (incluida la raiz).
      this.prisma.document.groupBy({
        by: ['categoryId'],
        where: { ownerId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const countByCategory = new Map<string, number>();
    let rootDocumentCount = 0;
    for (const row of counts) {
      if (row.categoryId === null) {
        rootDocumentCount = row._count._all;
      } else {
        countByCategory.set(row.categoryId, row._count._all);
      }
    }

    return { tree: this.buildTree(cats, countByCategory), rootDocumentCount };
  }

  // Edicion en el sitio (no cambia de carpeta padre).
  async update(ownerId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.assertOwned(ownerId, id);
    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: dto.name ?? undefined,
        color: dto.color ?? undefined,
        icon: dto.icon ?? undefined,
        position: dto.position ?? undefined,
      },
    });
  }

  /**
   * Mueve una carpeta.
   * - SUBTREE: la carpeta se lleva consigo toda su estructura (comportamiento natural).
   * - SINGLE: solo esta carpeta cambia de sitio; sus hijas directas suben a colgar
   *   de la carpeta padre inmediata (la de origen).
   */
  async move(
    ownerId: string,
    id: string,
    parentId: string | null,
    mode: TreeMode,
  ): Promise<Category> {
    const category = await this.assertOwned(ownerId, id);

    if (parentId !== null) {
      if (parentId === id) {
        throw new BadRequestException('Una carpeta no puede ser su propia carpeta padre');
      }
      await this.assertOwned(ownerId, parentId);
      if (mode === TreeMode.SUBTREE) {
        // Con el subarbol no se puede meter dentro de un descendiente (ciclo).
        const descendants = await this.descendantIds(ownerId, id);
        if (descendants.has(parentId)) {
          throw new BadRequestException('No se puede mover una carpeta dentro de una de sus subcarpetas');
        }
      }
      // En SINGLE no hay riesgo de ciclo (las hijas se desvinculan antes de mover).
    }

    if (mode === TreeMode.SINGLE) {
      // Las hijas directas suben al padre de origen de la carpeta.
      await this.prisma.category.updateMany({
        where: { parentId: id, ownerId, deletedAt: null },
        data: { parentId: category.parentId },
      });
    }

    const position = await this.nextPosition(ownerId, parentId);
    return this.prisma.category.update({
      where: { id: category.id },
      data: { parentId, position },
    });
  }

  /**
   * Envia a la papelera (soft-delete).
   * - SUBTREE: la carpeta, todo su subarbol y **los documentos de todas ellas**.
   * - SINGLE: solo esta carpeta; sus hijas directas **y sus documentos** suben
   *   al padre inmediato.
   *
   * NORMA: ninguna de las dos vias puede dejar un documento vivo colgando de
   * una carpeta borrada. Seria invisible: no esta en el arbol, `?categoryId`
   * de una carpeta borrada da 404, y tampoco esta en la papelera.
   *
   * En SUBTREE, la carpeta y todo lo que se lleva consigo comparten el MISMO
   * `deletedAt`. Ese instante identifica el lote y es lo que permite restaurar
   * despues justo lo que se borro junto (ver el modulo `trash`).
   */
  async remove(ownerId: string, id: string, mode: TreeMode): Promise<{ deleted: number }> {
    const category = await this.assertOwned(ownerId, id);
    const deletedAt = new Date();

    if (mode === TreeMode.SINGLE) {
      // Las hijas y los documentos directos suben al padre de origen; solo
      // desaparece esta carpeta.
      await this.prisma.$transaction([
        this.prisma.category.updateMany({
          where: { parentId: id, ownerId, deletedAt: null },
          data: { parentId: category.parentId },
        }),
        this.prisma.document.updateMany({
          where: { categoryId: id, ownerId, deletedAt: null },
          data: { categoryId: category.parentId },
        }),
        this.prisma.category.update({ where: { id: category.id }, data: { deletedAt } }),
      ]);
      return { deleted: 1 };
    }

    const ids = await this.descendantIds(ownerId, id);
    ids.add(id);
    const categoryIds = [...ids];
    const [cats] = await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { id: { in: categoryIds }, ownerId, deletedAt: null },
        data: { deletedAt },
      }),
      this.prisma.document.updateMany({
        where: { categoryId: { in: categoryIds }, ownerId, deletedAt: null },
        data: { deletedAt },
      }),
    ]);
    return { deleted: cats.count };
  }

  /** Reordena las carpetas hermanas de un nivel reasignando sus posiciones. */
  async reorder(
    ownerId: string,
    parentId: string | null,
    orderedIds: string[],
  ): Promise<{ reordered: number }> {
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('La lista de orden contiene IDs duplicados');
    }
    const siblings = await this.prisma.category.findMany({
      where: { ownerId, parentId, deletedAt: null },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (orderedIds.length !== siblingIds.size || !orderedIds.every((id) => siblingIds.has(id))) {
      throw new BadRequestException('La lista de orden no coincide con las carpetas de ese nivel');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.category.update({ where: { id }, data: { position: index } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  // ---------------- helpers ----------------

  private async assertOwned(ownerId: string, id: string): Promise<Category> {
    const cat = await this.prisma.category.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    if (!cat) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return cat;
  }

  private async nextPosition(ownerId: string, parentId: string | null): Promise<number> {
    const last = await this.prisma.category.findFirst({
      where: { ownerId, parentId, deletedAt: null },
      orderBy: { position: 'desc' },
    });
    return last ? last.position + 1 : 0;
  }

  /** IDs de todos los descendientes (subarbol) de rootId, sin incluirlo. */
  private async descendantIds(ownerId: string, rootId: string): Promise<Set<string>> {
    const all = await this.prisma.category.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const c of all) {
      const key = c.parentId ?? '__root__';
      const list = childrenByParent.get(key) ?? [];
      list.push(c.id);
      childrenByParent.set(key, list);
    }
    const result = new Set<string>();
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

  private buildTree(cats: Category[], countByCategory: Map<string, number>): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>();
    for (const c of cats) {
      nodes.set(c.id, {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        position: c.position,
        parentId: c.parentId,
        documentCount: countByCategory.get(c.id) ?? 0,
        children: [],
      });
    }
    const roots: CategoryNode[] = [];
    for (const c of cats) {
      const node = nodes.get(c.id) as CategoryNode;
      const parent = c.parentId ? nodes.get(c.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }
}
