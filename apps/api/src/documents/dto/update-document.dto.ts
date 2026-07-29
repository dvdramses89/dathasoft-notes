import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Edicion del documento en su sitio: titulo y/o contenido.
 * Cambiar de carpeta se hace con PATCH /documents/:id/move.
 */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El título no puede estar vacío' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  contentJson?: unknown;

  @IsOptional()
  @IsString()
  contentText?: string;
}
