import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { MoveDocumentDto } from './dto/move-document.dto';
import { ReorderDocumentsDto } from './dto/reorder-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // POST /api/documents
  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user.id, dto);
  }

  /**
   * GET /api/documents            -> todos los documentos del usuario
   * GET /api/documents?categoryId=<uuid> -> los de esa carpeta
   * GET /api/documents?categoryId=root   -> los de la raiz
   */
  @Get()
  list(@CurrentUser() user: PublicUser, @Query('categoryId') categoryId?: string) {
    return this.documents.list(user.id, this.parseCategoryFilter(categoryId));
  }

  /**
   * GET /api/documents/search?q=texto&tagIds=uuid,uuid
   *
   * Buscador global. Los dos parametros son opcionales y se combinan; los tags
   * filtran en modo Y (el documento debe llevarlos todos). Sin ninguno de los
   * dos devuelve una lista vacia.
   *
   * Va ANTES de :id, o la ruta con parametro capturaria "search".
   */
  @Get('search')
  search(
    @CurrentUser() user: PublicUser,
    @Query('q') q?: string,
    @Query('tagIds') tagIds?: string,
  ) {
    return this.documents.search(user.id, (q ?? '').trim(), this.parseTagIds(tagIds));
  }

  // PATCH /api/documents/reorder -> reordena los documentos de una carpeta
  // (se declara ANTES de :id para que no lo capture la ruta con parametro)
  @Patch('reorder')
  reorder(@CurrentUser() user: PublicUser, @Body() dto: ReorderDocumentsDto) {
    return this.documents.reorder(user.id, dto.categoryId ?? null, dto.orderedIds);
  }

  // GET /api/documents/:id -> documento con su contenido
  @Get(':id')
  findOne(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.findOne(user.id, id);
  }

  // PATCH /api/documents/:id -> guardar titulo / contenido
  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(user.id, id, dto);
  }

  // PATCH /api/documents/:id/move -> cambiar de carpeta (null = raiz)
  @Patch(':id/move')
  move(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDocumentDto,
  ) {
    return this.documents.move(user.id, id, dto.categoryId ?? null);
  }

  // DELETE /api/documents/:id -> papelera (soft-delete)
  @Delete(':id')
  remove(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(user.id, id);
  }

  /** Lista de UUIDs separados por comas, sin repetidos. Vacia si no viene. */
  private parseTagIds(value?: string): string[] {
    if (!value) {
      return [];
    }
    const ids = value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    for (const id of ids) {
      if (!UUID_RE.test(id)) {
        throw new BadRequestException('tagIds debe ser una lista de UUID separados por comas');
      }
    }
    return [...new Set(ids)];
  }

  /** undefined = sin filtro · null = raiz ("root") · uuid = esa carpeta. */
  private parseCategoryFilter(value?: string): string | null | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    if (value === 'root' || value === 'null') {
      return null;
    }
    if (!UUID_RE.test(value)) {
      throw new BadRequestException('categoryId debe ser un UUID o "root"');
    }
    return value;
  }
}
