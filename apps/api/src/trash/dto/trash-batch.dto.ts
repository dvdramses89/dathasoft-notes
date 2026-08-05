import { IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * Seleccion de la papelera sobre la que actuar. Los dos campos son opcionales
 * y se combinan; que al menos uno traiga algo lo comprueba el servicio, no el
 * DTO (con @ArrayNotEmpty en ambos no se podria mandar solo uno de los dos).
 */
export class TrashBatchDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];
}
