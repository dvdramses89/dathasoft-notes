import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // GET /api/health
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'dtnotes-api',
      env: this.config.get<string>('NODE_ENV') ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }

  // GET /api/health/db — comprueba la conexion real con PostgreSQL
  @Get('db')
  async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { db: 'ok' };
    } catch (err) {
      return {
        db: 'error',
        message: err instanceof Error ? err.message : 'Error desconocido',
      };
    }
  }
}
