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

  /**
   * 每 5 分钟对 logged_in 用户做一次心跳，确认 token 仍然有效。
   * 之前是每 5 秒，过于频繁且容易触发对端限流。
   */
  @Cron('0 */5 * * * *')
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
          .map(async (user) => {
            try {
              await this.timesClient.ping(`Bearer ${user.token}`);
              return { userId: user.userId, ok: true as const };
            } catch (error) {
              // ping 失败说明 token 已失效，标记为 expired 以便后续走刷新流程
              await this.dingtalkStore.updateUserStatus(user.userId, 'expired').catch(() => {});
              this.logger.warn(
                `用户心跳请求失败，已标记为过期：userId=${user.userId}，错误=${error instanceof Error ? error.message : error}`,
              );
              return { userId: user.userId, ok: false as const };
            }
          }),
      );

      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        this.logger.warn(`用户心跳检查完成，但有 ${rejectedCount} 个请求异常拒绝。`);
      }
    } finally {
      this.isRunning = false;
    }
  }
}
