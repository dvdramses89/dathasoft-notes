import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentsService, type DocumentListItem } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';

/** Respuesta de marcar/desmarcar: el estado final, no un contador. */
export interface FavoriteState {
  favorite: boolean;
}

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  /**
   * Documentos favoritos del usuario, del ultimo marcado al primero.
   *
   * Los que estan en la papelera no salen, pero conservan su favorito: al
   * restaurarlos vuelven a aparecer aqui. La proyeccion la hace
   * `DocumentsService`, que es quien sabe dar forma a un documento.
   */
  async list(ownerId: string): Promise<DocumentListItem[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: ownerId, document: { ownerId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: { documentId: true },
    });
    return this.documents.listByIds(
      ownerId,
      rows.map((row) => row.documentId),
    );
  }

  /** Marca el documento como favorito. Idempotente: repetirlo no falla. */
  async add(ownerId: string, documentId: string): Promise<FavoriteState> {
    await this.assertDocumentOwned(ownerId, documentId);
    await this.prisma.favorite.upsert({
      where: { userId_documentId: { userId: ownerId, documentId } },
      create: { userId: ownerId, documentId },
      update: {},
    });
    return { favorite: true };
  }

  /** Lo quita de favoritos. Idempotente: si no lo era, tampoco falla. */
  async remove(ownerId: string, documentId: string): Promise<FavoriteState> {
    await this.assertDocumentOwned(ownerId, documentId);
    await this.prisma.favorite.deleteMany({ where: { userId: ownerId, documentId } });
    return { favorite: false };
  }

  // ---------------- helpers ----------------

  private async assertDocumentOwned(ownerId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
  }
}
