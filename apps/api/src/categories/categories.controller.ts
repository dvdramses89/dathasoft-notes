import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { TreeMode } from './dto/tree-mode.enum';
import { UpdateCategoryDto } from './dto/update-category.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // POST /api/categories
  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.id, dto);
  }

  // GET /api/categories -> arbol de carpetas del usuario
  @Get()
  tree(@CurrentUser() user: PublicUser) {
    return this.categories.tree(user.id);
  }

  // PATCH /api/categories/reorder -> reordena las hermanas de un nivel
  // (se declara ANTES de :id para que no lo capture la ruta con parametro)
  @Patch('reorder')
  reorder(@CurrentUser() user: PublicUser, @Body() dto: ReorderCategoriesDto) {
    return this.categories.reorder(user.id, dto.parentId ?? null, dto.orderedIds);
  }

  // PATCH /api/categories/:id -> renombrar / color / icono / posicion
  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(user.id, id, dto);
  }

  // PATCH /api/categories/:id/move -> mover (mode: subtree | single)
  @Patch(':id/move')
  move(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.categories.move(user.id, id, dto.parentId ?? null, dto.mode);
  }

  // DELETE /api/categories/:id?mode=subtree|single -> papelera
  @Delete(':id')
  remove(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('mode', new DefaultValuePipe(TreeMode.SUBTREE), new ParseEnumPipe(TreeMode))
    mode: TreeMode,
  ) {
    return this.categories.remove(user.id, id, mode);
  }
}
