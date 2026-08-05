import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

// Exporta DocumentsService para que FavoritesModule pueda reutilizar la
// proyeccion de listado al devolver los documentos favoritos.
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
