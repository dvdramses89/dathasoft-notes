import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Vincular un tag a un documento se hace por NOMBRE, no por id: si el usuario ya
 * tiene ese tag se reutiliza, y si no, se crea sobre la marcha.
 */
export class AttachTagDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(50)
  name: string;

  // Solo se aplica si el tag hay que crearlo; sobre uno existente se ignora.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
}
