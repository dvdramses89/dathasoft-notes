import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(50)
  name: string;

  // Nombre de color de Mantine, igual que en las carpetas.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
}
