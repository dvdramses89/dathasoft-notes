import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

// Edicion en el sitio: renombrar / color / icono / reordenar.
// El MOVER (cambiar de carpeta padre) va por su propio endpoint /:id/move.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
