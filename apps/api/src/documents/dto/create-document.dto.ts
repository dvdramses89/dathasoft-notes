import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1, { message: 'El título es obligatorio' })
  @MaxLength(200)
  title: string;

  // Carpeta destino; omitido/null = documento en la raiz.
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  // Contenido del editor BlockNote (array de bloques). Si se omite, arranca vacio.
  @IsOptional()
  contentJson?: unknown;

  // Texto plano derivado del contenido, para el buscador full-text.
  @IsOptional()
  @IsString()
  contentText?: string;
}
