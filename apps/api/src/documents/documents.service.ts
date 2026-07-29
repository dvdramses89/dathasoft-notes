import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

/** Documento completo (incluye el contenido del editor). */
const fullSelect = {
  id: true,
  title: true,
  contentJson: true,
  contentText: true,
  categoryId: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

/** Version ligera para listados (sin el contenido). */
const listSelect = {
  id: true,
  title: true,
  categoryId: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

export type DocumentFull = Prisma.DocumentGetPayload<{ select: typeof fullSelect }>;
export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateDocumentDto): Promise<DocumentFull> {
    const categoryId = dto.categoryId ?? null;
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    const position = await this.nextPosition(ownerId, categoryId);
    return this.prisma.document.create({
      data: {
        title: dto.title,
        // Documento nuevo sin contenido = documento BlockNote vacio (array de bloques).
        contentJson: (dto.contentJson ?? []) as Prisma.InputJsonValue,
        contentText: dto.contentText ?? '',
        categoryId,
        position,
        ownerId,
      },
      select: fullSelect,
    });
  }

  /**
   * Lista los documentos del usuario (sin contenido).
   * `categoryId` filtra por carpeta: undefined = todos, null = solo la raiz.
   */
  async list(ownerId: string, categoryId?: string | null): Promise<DocumentListItem[]> {
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    return this.prisma.document.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: listSelect,
    });
  }

  async findOne(ownerId: string, id: string): Promise<DocumentFull> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: fullSelect,
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
    return doc;
  }

  /** Guarda titulo y/o contenido (el `searchVector` se recalcula solo en la BD). */
  async update(ownerId: string, id: string, dto: UpdateDocumentDto): Promise<DocumentFull> {
    await this.assertOwned(ownerId, id);
    return this.prisma.document.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        contentJson:
          dto.contentJson === undefined ? undefined : (dto.contentJson as Prisma.InputJsonValue),
        contentText: dto.contentText ?? undefined,
      },
      select: fullSelect,
    });
  }

  /** Mueve el documento a otra carpeta (o a la raiz), al final de la lista destino. */
  async move(ownerId: string, id: string, categoryId: string | null): Promise<DocumentFull> {
    await this.assertOwned(ownerId, id);
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    const position = await this.nextPosition(ownerId, categoryId);
    return this.prisma.document.update({
      where: { id },
      data: { categoryId, position },
      select: fullSelect,
    });
  }

  /** Envia el documento a la papelera (soft-delete). */
  async remove(ownerId: string, id: string): Promise<{ deleted: number }> {
    await this.assertOwned(ownerId, id);
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: 1 };
  }

  /** Reordena los documentos de una carpeta reasignando sus posiciones. */
  async reorder(
    ownerId: string,
    categoryId: string | null,
    orderedIds: string[],
  ): Promise<{ reordered: number }> {
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('La lista de orden contiene IDs duplicados');
    }
    const current = await this.prisma.document.findMany({
      where: { ownerId, categoryId, deletedAt: null },
      select: { id: true },
    });
    const currentIds = new Set(current.map((d) => d.id));
    if (orderedIds.length !== currentIds.size || !orderedIds.every((id) => currentIds.has(id))) {
      throw new BadRequestException('La lista de orden no coincide con los documentos de esa carpeta');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.document.update({ where: { id }, data: { position: index } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  // ---------------- helpers ----------------

  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
  }

  private async assertCategoryOwned(ownerId: string, categoryId: string): Promise<void> {
    const cat = await this.prisma.category.findFirst({
      where: { id: categoryId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!cat) {
      throw new NotFoundException('Categoría no encontrada');
    }
  }

  private async nextPosition(ownerId: string, categoryId: string | null): Promise<number> {
    const last = await this.prisma.document.findFirst({
      where: { ownerId, categoryId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }
}
