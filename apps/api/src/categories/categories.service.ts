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
  children: CategoryNode[];
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

  async tree(ownerId: string): Promise<CategoryNode[]> {
    const cats = await this.prisma.category.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return this.buildTree(cats);
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
   * - SUBTREE: la carpeta y todo su subarbol.
   * - SINGLE: solo esta carpeta; sus hijas directas suben al padre inmediato.
   */
  async remove(ownerId: string, id: string, mode: TreeMode): Promise<{ deleted: number }> {
    const category = await this.assertOwned(ownerId, id);

    if (mode === TreeMode.SINGLE) {
      await this.prisma.category.updateMany({
        where: { parentId: id, ownerId, deletedAt: null },
        data: { parentId: category.parentId },
      });
      await this.prisma.category.update({
        where: { id: category.id },
        data: { deletedAt: new Date() },
      });
      return { deleted: 1 };
    }

    const ids = await this.descendantIds(ownerId, id);
    ids.add(id);
    const result = await this.prisma.category.updateMany({
      where: { id: { in: [...ids] }, ownerId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deleted: result.count };
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

  private buildTree(cats: Category[]): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>();
    for (const c of cats) {
      nodes.set(c.id, {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        position: c.position,
        parentId: c.parentId,
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
