import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';

import { DingtalkService } from '../../dingtalk/dingtalk.service';
import { PushDeliveryService } from '../../push/push-delivery.service';
import { AiService } from '../ai/ai.service';
import { TimesheetService } from '../timesheet.service';
import { AutoFillStore } from './auto-fill.store';
import type { AutoFillConfig } from './auto-fill.types';

interface WeekBoardDay {
  date: string;
  isWeekend: boolean;
  status: string;
}

@Injectable()
export class AutoFillRuntimeScheduler {
  private readonly logger = new Logger(AutoFillRuntimeScheduler.name);

  constructor(
    private readonly autoFillStore: AutoFillStore,
    private readonly timesheetService: TimesheetService,
    private readonly aiService: AiService,
    private readonly pushService: PushDeliveryService,
    private readonly dingtalkService: DingtalkService,
  ) {}

  @Cron('0 30 9 * * 1-5')
  async handleAutoFill(): Promise<void> {
    this.logger.log('Auto-fill scheduler triggered');
    const configs = (await this.autoFillStore.getAll()).filter(
      (config) => config.enabled && !config.expired,
    );

    for (const config of configs) {
      try {
        await this.processUser(config);
      } catch (error) {
        this.logger.error(`Auto-fill failed for user ${config.userId}`, error);
      }
    }
  }

  private async processUser(config: AutoFillConfig): Promise<void> {
    if (this.isExpired(config.deadline)) {
      await this.autoFillStore.set({
        ...config,
        expired: true,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'expired',
      });
      await this.notifyUser(config.userId, '自动填报已超过截止日期，系统已停止执行。');
      return;
    }

    const token = await this.getTokenForUser(config.userId);
    if (!token) {
      await this.markFailed(config, '无法获取登录凭证，请重新登录后再开启自动填报。');
      return;
    }

    const today = this.getTodayKey();
    const weekBoard = await this.getWeekBoard(today, token);
    const todayData = weekBoard?.find((day) => day.date === today);

    if (!todayData) {
      await this.markFailed(config, '获取当日填报状态失败，请稍后重试。');
      return;
    }

    if (todayData.isWeekend) {
      await this.markSkipped(config, '今天是休息日，自动填报未执行。');
      return;
    }

    if (todayData.status !== '未提交') {
      await this.markSkipped(config, '今天工时已提交，自动填报未重复执行。');
      return;
    }

    const [content] = await this.aiService.generateWorkContents(config.work || '日常工作处理', 1);
    const payload = {
      reportDate: today,
      projectId: config.projectId,
      projectTitle: config.projectTitle,
      projectStatus: config.projectStatus,
      itemId: config.itemId,
      content: content || '日常工作处理',
      hours: config.hours,
    };

    try {
      await this.timesheetService.report(payload, token);
      await this.autoFillStore.set({
        ...config,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      await this.notifyUser(config.userId, '今天工时已自动填报成功。');
    } catch (error) {
      if (this.isAuthError(error)) {
        const retryToken = await this.dingtalkService.refreshUserToken(config.userId);

        if (retryToken) {
          try {
            await this.timesheetService.report(payload, retryToken);
            await this.autoFillStore.set({
              ...config,
              lastExecutedAt: new Date().toISOString(),
              lastExecutionStatus: 'success',
            });
            await this.notifyUser(config.userId, '今天工时已自动填报成功。');
            return;
          } catch (retryError) {
            this.logger.error(`Retry auto-fill failed for user ${config.userId}`, retryError);
          }
        }

        await this.markFailed(config, '自动填报凭证已失效，请重新执行钉钉登录。');
        return;
      }

      await this.markFailed(config, '今天工时自动填报失败，请手动处理。');
      this.logger.error(`Auto-fill failed for user ${config.userId}`, error);
    }
  }

  private async getTokenForUser(userId: string): Promise<string | null> {
    try {
      const user = await this.dingtalkService.getUserByUserId(userId);
      return user?.token ?? null;
    } catch {
      return null;
    }
  }

  private async getWeekBoard(date: string, token: string): Promise<WeekBoardDay[] | null> {
    try {
      const response = await this.timesheetService.getWeekBoard(date, token);
      const envelope = response as { data?: { days?: WeekBoardDay[] }; days?: WeekBoardDay[] };
      return envelope.data?.days ?? envelope.days ?? null;
    } catch {
      return null;
    }
  }

  private isExpired(deadline: string | null): boolean {
    if (!deadline) {
      return false;
    }

    return deadline < this.getTodayKey();
  }

  private isAuthError(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
  }

  private getTodayKey(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  private async markSkipped(config: AutoFillConfig, message: string): Promise<void> {
    await this.autoFillStore.set({
      ...config,
      lastExecutedAt: new Date().toISOString(),
      lastExecutionStatus: 'skipped',
    });
    await this.notifyUser(config.userId, message);
  }

  private async markFailed(config: AutoFillConfig, message: string): Promise<void> {
    await this.autoFillStore.set({
      ...config,
      lastExecutedAt: new Date().toISOString(),
      lastExecutionStatus: 'failed',
    });
    await this.notifyUser(config.userId, message);
  }

  private async notifyUser(userId: string, message: string): Promise<void> {
    try {
      await this.pushService.sendNotificationToUser(userId, {
        title: '工时填报通知',
        body: message,
        url: '/',
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for user ${userId}`, error);
    }
  }
}
