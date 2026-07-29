import { ArrayNotEmpty, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReorderDocumentsDto {
  // null/omitido = documentos de la raiz; uuid = documentos de esa carpeta.
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  // Nueva orden completa de los documentos de ese nivel.
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  orderedIds: string[];
}
