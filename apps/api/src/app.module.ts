import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Carga el .env y expone ConfigService de forma global
    ConfigModule.forRoot({ isGlobal: true }),
    // Acceso a la base de datos (Prisma) de forma global
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
