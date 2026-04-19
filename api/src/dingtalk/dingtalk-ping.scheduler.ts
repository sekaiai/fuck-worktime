import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DingtalkStore } from './dingtalk.store';
import { TimesClient } from '../user/times.client';

@Injectable()
export class DingtalkPingScheduler {
  private readonly logger = new Logger(DingtalkPingScheduler.name);
  private isRunning = false;

  constructor(
    private readonly dingtalkStore: DingtalkStore,
    private readonly timesClient: TimesClient,
  ) {}

  @Cron('*/5 * * * * *')
  async pingLoggedInUsers(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const users = await this.dingtalkStore.getUsersByStatus('logged_in');
      if (users.length === 0) {
        return;
      }

      const results = await Promise.allSettled(
        users
          .filter((user) => user.token.trim())
          .map((user) => this.timesClient.ping(`Bearer ${user.token}`)),
      );

      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        this.logger.warn(`Ping finished with ${rejectedCount} rejected requests.`);
      }
    } finally {
      this.isRunning = false;
    }
  }
}
