import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachTagDto } from './dto/attach-tag.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

/** Un tag tal y como sale de la API. Es la unica forma en que se devuelve. */
export const tagSelect = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
} satisfies Prisma.TagSelect;

export type TagItem = Prisma.TagGetPayload<{ select: typeof tagSelect }>;

/** Tag del listado general: ademas, en cuantos documentos vivos se usa. */
export type TagWithCount = TagItem & { documentCount: number };

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateTagDto): Promise<TagItem> {
    const name = this.normalizeName(dto.name);
    if (await this.findByName(ownerId, name)) {
      throw new ConflictException('Ya tienes una etiqueta con ese nombre');
    }
    return this.prisma.tag.create({
      data: { name, color: dto.color ?? null, ownerId },
      select: tagSelect,
    });
  }

  /**
   * Tags del usuario con el numero de documentos en que se usa cada uno.
   * El contador ignora los documentos que estan en la papelera.
   */
  async list(ownerId: string): Promise<TagWithCount[]> {
    const [tags, counts] = await Promise.all([
      this.prisma.tag.findMany({
        where: { ownerId },
        orderBy: { name: 'asc' },
        select: tagSelect,
      }),
      // Una sola consulta agrupada, igual que los contadores del arbol de carpetas.
      this.prisma.documentTag.groupBy({
        by: ['tagId'],
        where: { tag: { ownerId }, document: { ownerId, deletedAt: null } },
        _count: { _all: true },
      }),
    ]);

    const countByTag = new Map(counts.map((row) => [row.tagId, row._count._all]));
    return tags.map((tag) => ({ ...tag, documentCount: countByTag.get(tag.id) ?? 0 }));
  }

  /** Renombrar y/o cambiar el color. */
  async update(ownerId: string, id: string, dto: UpdateTagDto): Promise<TagItem> {
    await this.assertOwned(ownerId, id);
    const name = dto.name === undefined ? undefined : this.normalizeName(dto.name);
    if (name !== undefined) {
      const existing = await this.findByName(ownerId, name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya tienes una etiqueta con ese nombre');
      }
    }
    return this.prisma.tag.update({
      where: { id },
      data: { name, color: dto.color ?? undefined },
      select: tagSelect,
    });
  }

  /**
   * Borra el tag. Es un borrado FISICO: `Tag` no tiene papelera, y sus vinculos
   * en `DocumentTag` caen solos por el `onDelete: Cascade` de la FK.
   */
  async remove(ownerId: string, id: string): Promise<{ deleted: number }> {
    await this.assertOwned(ownerId, id);
    await this.prisma.tag.delete({ where: { id } });
    return { deleted: 1 };
  }

  async listForDocument(ownerId: string, documentId: string): Promise<TagItem[]> {
    await this.assertDocumentOwned(ownerId, documentId);
    return this.tagsOf(documentId);
  }

  /**
   * Vincula un tag al documento buscandolo POR NOMBRE: si el usuario ya lo tiene
   * se reutiliza (sin distinguir mayusculas), y si no, se crea. Es idempotente:
   * repetir la llamada no duplica el vinculo.
   */
  async attach(ownerId: string, documentId: string, dto: AttachTagDto): Promise<TagItem[]> {
    await this.assertDocumentOwned(ownerId, documentId);
    const name = this.normalizeName(dto.name);
    const tag =
      (await this.findByName(ownerId, name)) ??
      (await this.prisma.tag.create({
        data: { name, color: dto.color ?? null, ownerId },
        select: tagSelect,
      }));
    await this.prisma.documentTag.upsert({
      where: { documentId_tagId: { documentId, tagId: tag.id } },
      create: { documentId, tagId: tag.id },
      update: {},
    });
    return this.tagsOf(documentId);
  }

  /**
   * Quita el tag del documento, pero NO borra el tag: sigue disponible para
   * otros documentos. Si el vinculo no existia devuelve `{ removed: 0 }`.
   */
  async detach(ownerId: string, documentId: string, tagId: string): Promise<{ removed: number }> {
    await this.assertDocumentOwned(ownerId, documentId);
    const result = await this.prisma.documentTag.deleteMany({ where: { documentId, tagId } });
    return { removed: result.count };
  }

  // ---------------- helpers ----------------

  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!tag) {
      throw new NotFoundException('Etiqueta no encontrada');
    }
  }

  private async assertDocumentOwned(ownerId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
  }

  /**
   * Busca un tag del usuario por nombre SIN distinguir mayusculas, para que
   * "React" y "react" no acaben siendo dos tags distintos. El indice unico de
   * la BD (`ownerId + name`) si distingue, asi que la comprobacion es de aqui.
   */
  private async findByName(ownerId: string, name: string): Promise<TagItem | null> {
    return this.prisma.tag.findFirst({
      where: { ownerId, name: { equals: name, mode: 'insensitive' } },
      select: tagSelect,
    });
  }

  private async tagsOf(documentId: string): Promise<TagItem[]> {
    const links = await this.prisma.documentTag.findMany({
      where: { documentId },
      orderBy: { tag: { name: 'asc' } },
      select: { tag: { select: tagSelect } },
    });
    return links.map((link) => link.tag);
  }

  /** Recorta los extremos y colapsa los espacios internos: "  a   b " -> "a b". */
  private normalizeName(raw: string): string {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (name.length === 0) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }
    return name;
  }
}
