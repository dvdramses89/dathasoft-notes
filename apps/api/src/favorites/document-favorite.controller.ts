import { Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

/**
 * El favorito de un documento concreto. Vive en el modulo `favorites` (no en
 * `documents`) porque toda la logica esta en `FavoritesService`, igual que
 * pasa con los tags.
 *
 * No colisiona con `GET /api/documents/:id`: tiene un segmento mas.
 */
@UseGuards(JwtAuthGuard)
@Controller('documents/:documentId/favorite')
export class DocumentFavoriteController {
  constructor(private readonly favorites: FavoritesService) {}

  // POST /api/documents/:documentId/favorite -> marcar
  @Post()
  add(@CurrentUser() user: PublicUser, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.favorites.add(user.id, documentId);
  }

  // DELETE /api/documents/:documentId/favorite -> desmarcar
  @Delete()
  remove(@CurrentUser() user: PublicUser, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.favorites.remove(user.id, documentId);
  }
}
