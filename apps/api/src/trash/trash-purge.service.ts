import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrashService } from './trash.service';

/** Dias que algo aguanta en la papelera antes de borrarse solo. */
const DEFAULT_RETENTION_DAYS = 30;

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

  constructor(
    private readonly trash: TrashService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    const days = this.retentionDays();
    const { purged } = await this.trash.purgeOlderThan(days);
    if (purged > 0) {
      this.logger.log(`Papelera: ${purged} elemento(s) con mas de ${days} dias borrados`);
    }
  }

  /** El valor del .env, o 30. Un valor no valido o <= 0 cae al default. */
  private retentionDays(): number {
    const raw = Number(this.config.get<string>('TRASH_RETENTION_DAYS'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
  }
}
