import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrashService } from './trash.service';

/**
 * Vaciado automatico de la papelera. Una vez al dia borra definitivamente lo
 * que lleve mas de `TRASH_RETENTION_DAYS` dias dentro, de todos los usuarios.
 *
 * El plazo es de instalacion, no de usuario: cuando exista la seccion de
 * Configuracion por usuario (fase futura, anotada en PLAN.md), este valor
 * pasara a ser el default y cada usuario podra cambiar el suyo.
 */
@Injectable()
export class TrashPurgeService {
  private readonly logger = new Logger(TrashPurgeService.name);

  constructor(private readonly trash: TrashService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    const days = this.trash.retentionDays();
    const { purged } = await this.trash.purgeOlderThan(days);
    if (purged > 0) {
      this.logger.log(`Papelera: ${purged} elemento(s) con mas de ${days} dias borrados`);
    }
  }
}
