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

/**
 * Marca de favorito DEL USUARIO QUE CONSULTA. El filtro por `userId` no es
 * redundante: hoy solo el dueno puede marcar un documento, pero cuando la
 * Fase 9 permita ver documentos ajenos, el favorito de otro no debe contar
 * como propio. Se aplana a un booleano antes de responder.
 */
function favoritesOf(ownerId: string) {
  return { where: { userId: ownerId }, select: { userId: true } } as const;
}

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

/**
 * Lo que se pide de verdad a la BD en un detalle: lo anterior, mas los tags y
 * la marca de favorito. Es una funcion, y no una constante como las dos de
 * arriba, porque el favorito se filtra por el usuario que consulta.
 */
function fullQuerySelect(ownerId: string) {
  return {
    ...fullSelect,
    tags: tagsRelation,
    favorites: favoritesOf(ownerId),
  } satisfies Prisma.DocumentSelect;
}

/**
 * Lo que se pide de verdad a la BD en un listado: lo anterior mas el texto
 * plano, del que solo sale el extracto. `contentText` no se devuelve.
 */
function listQuerySelect(ownerId: string) {
  return {
    ...listSelect,
    contentText: true,
    tags: tagsRelation,
    favorites: favoritesOf(ownerId),
  } satisfies Prisma.DocumentSelect;
}

/** Caracteres de texto que viajan en un listado, para la vista previa. */
const EXCERPT_LENGTH = 240;

/**
 * Tope de resultados del buscador. La API no tiene paginacion en ningun sitio,
 * asi que se acota aqui para no devolver el corpus entero: el front avisa
 * cuando recibe justo este numero.
 */
const SEARCH_LIMIT = 50;

/** Fila cruda del detalle, con los tags y el favorito sin aplanar. */
type DocumentFullRow = Prisma.DocumentGetPayload<{ select: ReturnType<typeof fullQuerySelect> }>;

/** Fila cruda de un listado, con el texto plano que aqui se recorta. */
type DocumentListRow = Prisma.DocumentGetPayload<{ select: ReturnType<typeof listQuerySelect> }>;

export type DocumentFull = Prisma.DocumentGetPayload<{ select: typeof fullSelect }> & {
  tags: TagItem[];
  isFavorite: boolean;
};

/** Documento de un listado: sin el contenido, con un extracto para la vista previa. */
export type DocumentListItem = Prisma.DocumentGetPayload<{ select: typeof listSelect }> & {
  excerpt: string;
  tags: TagItem[];
  isFavorite: boolean;
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
      select: fullQuerySelect(ownerId),
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
      select: listQuerySelect(ownerId),
    });
    return this.toListItems(docs);
  }

  /**
   * Buscador global: texto completo sobre `title` + `contentText` y/o filtro por
   * tags. Los dos criterios son opcionales y se combinan:
   *
   * - `q` usa la columna generada `searchVector` (titulo con peso A, cuerpo con
   *   peso B) y ordena por `ts_rank`, de mas a menos relevante.
   * - `tagIds` filtra en modo Y: el documento debe llevar TODOS los tags.
   * - Sin ningun criterio devuelve `[]`, no el corpus entero.
   */
  async search(ownerId: string, q: string, tagIds: string[]): Promise<DocumentListItem[]> {
    if (!q && tagIds.length === 0) {
      return [];
    }

    // Orden de relevancia: solo lo puede calcular Postgres, porque Prisma no
    // sabe consultar una columna `tsvector`. Es la unica consulta cruda del
    // modulo, y va con template tag (parametrizada), nunca concatenada.
    let rankedIds: string[] | null = null;
    if (q) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT d."id"
        FROM "Document" d, websearch_to_tsquery('spanish', ${q}) AS query
        WHERE d."ownerId" = ${ownerId}::uuid
          AND d."deletedAt" IS NULL
          AND d."searchVector" @@ query
        ORDER BY ts_rank(d."searchVector", query) DESC, d."updatedAt" DESC
        LIMIT ${SEARCH_LIMIT}
      `;
      rankedIds = rows.map((row) => row.id);
      if (rankedIds.length === 0) {
        return [];
      }
    }

    // El resto va por Prisma: proyeccion, tags y el filtro Y de etiquetas.
    const docs = await this.prisma.document.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(rankedIds ? { id: { in: rankedIds } } : {}),
        // Un `some` por tag: asi se exigen todos, no cualquiera de ellos.
        ...(tagIds.length > 0 ? { AND: tagIds.map((tagId) => ({ tags: { some: { tagId } } })) } : {}),
      },
      // Con texto manda la relevancia (se reordena abajo); sin el, lo reciente.
      orderBy: rankedIds ? undefined : [{ updatedAt: 'desc' }],
      take: SEARCH_LIMIT,
      select: listQuerySelect(ownerId),
    });

    const items = this.toListItems(docs);
    return rankedIds ? this.orderByIds(items, rankedIds) : items;
  }

  /**
   * Documentos concretos del usuario, con la proyeccion de listado y **en el
   * mismo orden en que llegan los ids**. Lo usa el modulo `favorites`, que
   * decide el orden en su propia consulta y aqui solo necesita la forma.
   * Los ids de la papelera o de otro usuario se descartan en silencio.
   */
  async listByIds(ownerId: string, ids: string[]): Promise<DocumentListItem[]> {
    if (ids.length === 0) {
      return [];
    }
    const docs = await this.prisma.document.findMany({
      where: { id: { in: ids }, ownerId, deletedAt: null },
      select: listQuerySelect(ownerId),
    });
    return this.orderByIds(this.toListItems(docs), ids);
  }

  async findOne(ownerId: string, id: string): Promise<DocumentFull> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: fullQuerySelect(ownerId),
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
      select: fullQuerySelect(ownerId),
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
      select: fullQuerySelect(ownerId),
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

  /**
   * Da forma a las filas de un listado: descarta `contentText` —que no sale
   * nunca entero de la API, solo como extracto— y aplana tags y favorito.
   */
  private toListItems(rows: DocumentListRow[]): DocumentListItem[] {
    return rows.map(({ contentText, tags, favorites, ...doc }) => ({
      ...doc,
      excerpt: this.toExcerpt(contentText),
      tags: tags.map((link) => link.tag),
      isFavorite: favorites.length > 0,
    }));
  }

  /** Aplana la fila: los tags (`[{tag}]` -> `[tag]`) y el favorito a booleano. */
  private toFull(doc: DocumentFullRow): DocumentFull {
    const { tags, favorites, ...rest } = doc;
    return {
      ...rest,
      tags: tags.map((link) => link.tag),
      isFavorite: favorites.length > 0,
    };
  }

  /** Deja los documentos en el orden en que llegan los ids. */
  private orderByIds(items: DocumentListItem[], ids: string[]): DocumentListItem[] {
    const position = new Map(ids.map((id, index) => [id, index]));
    return items.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
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
