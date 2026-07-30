import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // Carga el .env y expone ConfigService de forma global.
    // `validate` corre antes que cualquier otro modulo: si falta una variable
    // obligatoria, el arranque se aborta aqui.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Acceso a la base de datos (Prisma) de forma global
    PrismaModule,
    // Autenticacion (registro / login)
    AuthModule,
    // Categorias (arbol de carpetas)
    CategoriesModule,
    // Documentos (notas dentro de las carpetas)
    DocumentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
