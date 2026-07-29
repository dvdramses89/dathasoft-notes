import { IsOptional, IsUUID } from 'class-validator';

export class MoveDocumentDto {
  // null/omitido = mover a la raiz; uuid = mover dentro de esa carpeta.
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
