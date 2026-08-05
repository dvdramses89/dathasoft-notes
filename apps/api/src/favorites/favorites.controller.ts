import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  // GET /api/favorites -> documentos favoritos, del ultimo marcado al primero
  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.favorites.list(user.id);
  }
}
