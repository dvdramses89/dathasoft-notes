import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  // POST /api/tags
  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateTagDto) {
    return this.tags.create(user.id, dto);
  }

  // GET /api/tags -> tags del usuario, con su numero de documentos
  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.tags.list(user.id);
  }

  // PATCH /api/tags/:id -> renombrar / color
  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tags.update(user.id, id, dto);
  }

  // DELETE /api/tags/:id -> borra el tag y lo quita de todos sus documentos
  @Delete(':id')
  remove(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tags.remove(user.id, id);
  }
}
