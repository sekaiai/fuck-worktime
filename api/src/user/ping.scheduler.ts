import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';

import { TimesClient } from './times.client';
import { UserStore } from './user.store';

@Injectable()
export class PingScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PingScheduler.name);
  private readonly intervalMs = 10000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly userStore: UserStore,
    private readonly timesClient: TimesClient,
  ) {}

  async onApplicationBootstrap() {
    await this.userStore.ensureFileExists();
    await this.ensureStarted();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ensureStarted() {
    if (this.timer) {
      return;
    }

    const users = await this.userStore.readUsers();

    if (users.length === 0) {
      this.logger.log('No authorized users found. Ping scheduler is idle.');
      return;
    }

    this.timer = setInterval(() => {
      void this.runHeartbeatCycle();
    }, this.intervalMs);

    this.logger.log(`Ping scheduler started. Running every ${this.intervalMs}ms.`);
    void this.runHeartbeatCycle();
  }

  private async runHeartbeatCycle() {
    const users = await this.userStore.readUsers();

    if (users.length === 0) {
      this.logger.debug('Skip heartbeat cycle because user.json is empty.');
      return;
    }

    for (const user of users) {
      try {
        await this.timesClient.ping(user.authorization);
        this.logger.log(`Heartbeat success for ${user.phone}.`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown heartbeat error';
        this.logger.warn(`Heartbeat failed for ${user.phone}: ${errorMessage}`);
      }
    }
  }
}
