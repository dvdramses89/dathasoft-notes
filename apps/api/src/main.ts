import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // CORS abierto en desarrollo (el SPA lo consumira desde otro puerto)
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;

  await app.listen(port);
  Logger.log(`DTNotes API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
