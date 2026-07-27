import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El email no es valido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(100)
  password: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(100)
  name: string;
}
