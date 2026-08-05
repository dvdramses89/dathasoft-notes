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
import { TrashBatchDto } from './dto/trash-batch.dto';
import { TrashService } from './trash.service';

@UseGuards(JwtAuthGuard)
@Controller('trash')
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  // GET /api/trash -> carpetas y documentos en la papelera (solo las raices)
  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.trash.list(user.id);
  }

  // DELETE /api/trash -> vaciar la papelera entera (borrado FISICO)
  // Se declara antes que las rutas con parametro, por costumbre del proyecto.
  @Delete()
  empty(@CurrentUser() user: PublicUser) {
    return this.trash.empty(user.id);
  }

  // POST /api/trash/restore -> restaura una seleccion entera de una vez
  // (se declara ANTES de las rutas con parametro, por costumbre del proyecto)
  @Post('restore')
  restoreMany(@CurrentUser() user: PublicUser, @Body() dto: TrashBatchDto) {
    return this.trash.restoreMany(user.id, dto);
  }

  // POST /api/trash/purge -> borra definitivamente una seleccion entera
  // Es POST y no DELETE porque lleva body: un DELETE con cuerpo es legal pero
  // lo tratan mal proxies y clientes, y aqui la seleccion puede ser larga.
  @Post('purge')
  purgeMany(@CurrentUser() user: PublicUser, @Body() dto: TrashBatchDto) {
    return this.trash.purgeMany(user.id, dto);
  }

  // POST /api/trash/documents/:id/restore
  @Post('documents/:id/restore')
  restoreDocument(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreDocument(user.id, id);
  }

  // POST /api/trash/categories/:id/restore -> restaura tambien lo que se borro con ella
  @Post('categories/:id/restore')
  restoreCategory(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreCategory(user.id, id);
  }

  // DELETE /api/trash/documents/:id -> borrado FISICO
  @Delete('documents/:id')
  purgeDocument(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.purgeDocument(user.id, id);
  }

  // DELETE /api/trash/categories/:id -> borrado FISICO, con su subarbol
  @Delete('categories/:id')
  purgeCategory(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.purgeCategory(user.id, id);
  }
}
