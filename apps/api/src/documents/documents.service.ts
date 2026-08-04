import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { tagSelect, type TagItem } from '../tags/tags.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

/**
 * Vinculos de tags del documento, ordenados por nombre. Se piden asi a la BD y
 * se aplanan antes de responder: la API devuelve los tags, no la tabla pivote.
 */
const tagsRelation = {
  select: { tag: { select: tagSelect } },
  orderBy: { tag: { name: 'asc' } },
} as const;

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

/** Lo que se pide de verdad a la BD en un detalle: lo anterior mas los tags. */
const fullQuerySelect = {
  ...fullSelect,
  tags: tagsRelation,
} satisfies Prisma.DocumentSelect;

/**
 * Lo que se pide de verdad a la BD en un listado: lo anterior mas el texto
 * plano, del que solo sale el extracto, y los tags. `contentText` no se devuelve.
 */
const listQuerySelect = {
  ...listSelect,
  contentText: true,
  tags: tagsRelation,
} satisfies Prisma.DocumentSelect;

/** Caracteres de texto que viajan en un listado, para la vista previa. */
const EXCERPT_LENGTH = 240;

/** Fila cruda del detalle, con los vinculos de tags sin aplanar. */
type DocumentFullRow = Prisma.DocumentGetPayload<{ select: typeof fullQuerySelect }>;

export type DocumentFull = Prisma.DocumentGetPayload<{ select: typeof fullSelect }> & {
  tags: TagItem[];
};

/** Documento de un listado: sin el contenido, con un extracto para la vista previa. */
export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }> & {
  excerpt: string;
  tags: TagItem[];
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateDocumentDto): Promise<DocumentFull> {
    const categoryId = dto.categoryId ?? null;
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    const position = await this.nextPosition(ownerId, categoryId);
    const doc = await this.prisma.document.create({
      data: {
        title: dto.title,
        // Documento nuevo sin contenido = documento BlockNote vacio (array de bloques).
        contentJson: (dto.contentJson ?? []) as Prisma.InputJsonValue,
        contentText: dto.contentText ?? '',
        categoryId,
        position,
        ownerId,
      },
      select: fullQuerySelect,
    });
    return this.toFull(doc);
  }

  /**
   * Lista los documentos del usuario (sin contenido).
   * `categoryId` filtra por carpeta: undefined = todos, null = solo la raiz.
   */
  async list(ownerId: string, categoryId?: string | null): Promise<DocumentListItem[]> {
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    const docs = await this.prisma.document.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: listQuerySelect,
    });
    // `contentText` se descarta aqui: solo sale de la API como extracto.
    return docs.map(({ contentText, tags, ...doc }) => ({
      ...doc,
      excerpt: this.toExcerpt(contentText),
      tags: tags.map((link) => link.tag),
    }));
  }

  async findOne(ownerId: string, id: string): Promise<DocumentFull> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: fullQuerySelect,
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
    return this.toFull(doc);
  }

  /** Guarda titulo y/o contenido (el `searchVector` se recalcula solo en la BD). */
  async update(ownerId: string, id: string, dto: UpdateDocumentDto): Promise<DocumentFull> {
    await this.assertOwned(ownerId, id);
    const doc = await this.prisma.document.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        contentJson:
          dto.contentJson === undefined ? undefined : (dto.contentJson as Prisma.InputJsonValue),
        contentText: dto.contentText ?? undefined,
      },
      select: fullQuerySelect,
    });
    return this.toFull(doc);
  }

  /** Mueve el documento a otra carpeta (o a la raiz), al final de la lista destino. */
  async move(ownerId: string, id: string, categoryId: string | null): Promise<DocumentFull> {
    await this.assertOwned(ownerId, id);
    if (categoryId) {
      await this.assertCategoryOwned(ownerId, categoryId);
    }
    const position = await this.nextPosition(ownerId, categoryId);
    const doc = await this.prisma.document.update({
      where: { id },
      data: { categoryId, position },
      select: fullQuerySelect,
    });
    return this.toFull(doc);
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

  /** Aplana los vinculos de tags de la fila: `[{tag}]` -> `[tag]`. */
  private toFull(doc: DocumentFullRow): DocumentFull {
    const { tags, ...rest } = doc;
    return { ...rest, tags: tags.map((link) => link.tag) };
  }

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

  /**
   * Recorta el texto plano para la vista previa de los listados. Corta en el
   * ultimo espacio para no partir una palabra por la mitad, y conserva los
   * saltos de linea: la vista de tarjetas los respeta.
   */
  private toExcerpt(contentText: string): string {
    const text = contentText.trim();
    if (text.length <= EXCERPT_LENGTH) {
      return text;
    }
    const cut = text.slice(0, EXCERPT_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    return `${lastSpace > EXCERPT_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
  }
}
