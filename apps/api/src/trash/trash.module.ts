import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TrashPurgeService } from './trash-purge.service';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

// ScheduleModule.forRoot() se registra aqui, y no en AppModule, porque la
// purga de la papelera es la unica tarea programada de la API.
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [TrashController],
  providers: [TrashService, TrashPurgeService],
})
export class TrashModule {}
