import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Origenes del SPA en local. Solo se usan si CORS_ORIGINS no viene definida,
// y nunca en produccion (alli la variable es obligatoria: ver env.validation.ts).
const ORIGENES_LOCALES = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * Convierte la lista separada por comas de CORS_ORIGINS en un array.
 * Si no hay valor, cae a los origenes locales del SPA.
 */
function resolverOrigenes(valor: string | undefined): string[] {
  const origenes = (valor ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);

  return origenes.length > 0 ? origenes : ORIGENES_LOCALES;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // Validacion automatica de DTOs (rechaza campos no permitidos y transforma tipos)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  // CORS con allowlist: solo los origenes de CORS_ORIGINS (o el localhost del
  // SPA en desarrollo). Un origen fuera de la lista no recibe la cabecera
  // Access-Control-Allow-Origin y el navegador bloquea la respuesta.
  // Las peticiones sin cabecera Origin (curl, health checks) no llevan
  // politica CORS y siguen funcionando: CORS solo protege al navegador.
  const origenes = resolverOrigenes(config.get<string>('CORS_ORIGINS'));
  app.enableCors({
    origin: origenes,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // El token viaja en la cabecera Authorization, no en cookies
    credentials: false,
    maxAge: 86400,
  });

  // Cierre ordenado (Prisma se desconecta en onModuleDestroy)
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;

  await app.listen(port);
  Logger.log(`DTNotes API escuchando en http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`CORS permitido para: ${origenes.join(', ')}`, 'Bootstrap');
}

void bootstrap();
