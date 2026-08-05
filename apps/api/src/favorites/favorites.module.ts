import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentFavoriteController } from './document-favorite.controller';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

// Importa DocumentsModule para reutilizar la proyeccion de documentos al
// listar los favoritos (mismo patron que AuthModule con UsersModule).
@Module({
  imports: [DocumentsModule],
  controllers: [FavoritesController, DocumentFavoriteController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
