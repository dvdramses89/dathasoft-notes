import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachTagDto } from './dto/attach-tag.dto';
import { TagsService } from './tags.service';

/**
 * Los tags de un documento concreto. Vive en el modulo `tags` (no en
 * `documents`) porque toda la logica de tags esta en `TagsService`.
 */
@UseGuards(JwtAuthGuard)
@Controller('documents/:documentId/tags')
export class DocumentTagsController {
  constructor(private readonly tags: TagsService) {}

  // GET /api/documents/:documentId/tags
  @Get()
  list(
    @CurrentUser() user: PublicUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.tags.listForDocument(user.id, documentId);
  }

  // POST /api/documents/:documentId/tags -> vincula por nombre (lo crea si no existe)
  @Post()
  attach(
    @CurrentUser() user: PublicUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AttachTagDto,
  ) {
    return this.tags.attach(user.id, documentId, dto);
  }

  // DELETE /api/documents/:documentId/tags/:tagId -> quita el tag del documento
  @Delete(':tagId')
  detach(
    @CurrentUser() user: PublicUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.tags.detach(user.id, documentId, tagId);
  }
}
