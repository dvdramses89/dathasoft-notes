import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

// Longitud minima del secreto de firma del JWT. El comando que sugiere
// .env.example genera 48 bytes (96 caracteres hex), asi que va sobrado.
const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Contrato de las variables de entorno de la API.
 *
 * Las variables sin `@IsOptional()` son OBLIGATORIAS: si faltan, la API no
 * arranca. Las opcionales conservan su default inline en el consumidor
 * (`?? 3000` en main.ts, `?? '1d'` en auth.module.ts).
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'], {
    message: 'debe ser development, production o test',
  })
  NODE_ENV?: string;

  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero' })
  @Min(1, { message: 'debe estar entre 1 y 65535' })
  @Max(65535, { message: 'debe estar entre 1 y 65535' })
  PORT?: number;

  @IsString({ message: 'debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'es obligatoria y no puede estar vacía' })
  DATABASE_URL: string;

  @IsString({ message: 'debe ser una cadena de texto' })
  @MinLength(JWT_SECRET_MIN_LENGTH, {
    message: `es obligatorio y debe tener al menos ${JWT_SECRET_MIN_LENGTH} caracteres`,
  })
  JWT_SECRET: string;

  @IsOptional()
  @IsString({ message: 'debe ser una cadena de texto (ejemplos: 1d, 12h, 3600s)' })
  @IsNotEmpty({ message: 'no puede estar vacía' })
  JWT_EXPIRES_IN?: string;

  // Origenes permitidos por CORS, separados por comas.
  // En desarrollo es opcional (se usa el localhost del SPA de Vite);
  // en produccion es obligatoria, para no dejar la API abierta al mundo.
  // Sin @IsString: @IsNotEmpty ya cubre el caso de que falte, y asi el
  // mensaje de error no repite dos motivos para lo mismo.
  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV === 'production')
  @IsNotEmpty({
    message:
      'es obligatoria cuando NODE_ENV=production (origenes separados por comas, ' +
      'ejemplo: https://notes.midominio.com)',
  })
  CORS_ORIGINS?: string;

  // Rate limiting de /api/auth/login y /api/auth/register.
  // Los TTL van en SEGUNDOS aqui; auth.module.ts los pasa a milisegundos,
  // que es lo que espera @nestjs/throttler.
  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero' })
  @Min(1, { message: 'debe ser 1 o mayor' })
  THROTTLE_LOGIN_LIMIT?: number;

  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero de segundos' })
  @Min(1, { message: 'debe ser 1 o mayor' })
  THROTTLE_LOGIN_TTL?: number;

  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero' })
  @Min(1, { message: 'debe ser 1 o mayor' })
  THROTTLE_REGISTER_LIMIT?: number;

  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero de segundos' })
  @Min(1, { message: 'debe ser 1 o mayor' })
  THROTTLE_REGISTER_TTL?: number;

  // Dias que algo aguanta en la papelera antes de que la tarea diaria lo borre
  // definitivamente. Es un plazo de instalacion; el default (30) esta inline
  // en trash-purge.service.ts.
  @IsOptional()
  @IsInt({ message: 'debe ser un numero entero de dias' })
  @Min(1, { message: 'debe ser 1 o mayor' })
  TRASH_RETENTION_DAYS?: number;
}

/**
 * Se pasa a `ConfigModule.forRoot({ validate })`. Si algo no cuadra, lanza y
 * Nest aborta el arranque: preferimos no levantar la API antes que levantarla
 * con un secreto vacio.
 *
 * Devuelve la instancia validada, que es la que consulta `ConfigService`
 * (`getFromValidatedEnv` tiene prioridad). Por eso `PORT` llega ya como
 * numero de verdad y no como el string de `process.env`.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length === 0) {
    return parsed;
  }

  // Solo el nombre de la variable y el motivo. NUNCA el valor: este mensaje
  // acaba en el log de arranque y JWT_SECRET no puede aparecer ahi.
  const detalle = errors
    .map((error) => {
      // Set: con un valor no numerico fallan @IsInt, @Min y @Max a la vez,
      // y los dos ultimos comparten mensaje.
      const motivos = [...new Set(Object.values(error.constraints ?? {}))].join('; ');
      return `  - ${error.property}: ${motivos}`;
    })
    .join('\n');

  throw new Error(
    `Configuración de entorno inválida. La API no arranca.\n${detalle}\n` +
      'Revisa apps/api/.env (tienes la plantilla en apps/api/.env.example).',
  );
}
