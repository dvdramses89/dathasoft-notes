import { ArrayNotEmpty, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReorderCategoriesDto {
  // null/omitido = hermanas de la raiz; uuid = hijas de esa carpeta.
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  // Nueva orden completa de las carpetas hermanas de ese nivel.
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  orderedIds: string[];
}
