import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Modulo global: expone PrismaService a toda la app sin re-importarlo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
