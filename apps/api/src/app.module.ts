import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Carga el .env y expone ConfigService de forma global
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
