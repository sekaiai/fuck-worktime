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

interface AutoFillReportPayload {
  reportDate: string;
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  itemId: string;
  content: string;
  hours: number;
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
    if (!weekBoard) {
      await this.markFailed(config, '获取本周填报状态失败，请稍后重试。');
      return;
    }

    const fillableDays = weekBoard
      .filter((day) => !day.isWeekend && day.status === '未提交' && day.date <= today)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (fillableDays.length === 0) {
      await this.markSkipped(config, '本周当前没有可自动填报的未提交工作日。');
      return;
    }

    const contents = await this.aiService.generateWorkContents(
      config.work || '日常工作处理',
      fillableDays.length,
    );

    const payloads = fillableDays.map<AutoFillReportPayload>((day, index) => ({
      reportDate: day.date,
      projectId: config.projectId,
      projectTitle: config.projectTitle,
      projectStatus: config.projectStatus,
      itemId: config.itemId,
      content: contents[index] || '日常工作处理',
      hours: config.hours,
    }));

    try {
      const submittedCount = await this.submitReportsSequentially(config.userId, payloads, token);
      await this.autoFillStore.set({
        ...config,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      await this.notifyUser(
        config.userId,
        `本周自动填报成功，已提交 ${submittedCount} 条工时。`,
      );
    } catch (error) {
      await this.markFailed(config, '本周自动填报失败，请手动处理未提交工时。');
      this.logger.error(`Auto-fill failed for user ${config.userId}`, error);
    }
  }

  private async submitReportsSequentially(
    userId: string,
    payloads: AutoFillReportPayload[],
    initialToken: string,
  ): Promise<number> {
    let token = initialToken;
    let submittedCount = 0;

    for (const payload of payloads) {
      try {
        await this.timesheetService.report(payload, token);
        submittedCount += 1;
      } catch (error) {
        if (!this.isAuthError(error)) {
          throw error;
        }

        const retryToken = await this.dingtalkService.refreshUserToken(userId);
        if (!retryToken) {
          throw error;
        }

        token = retryToken;
        await this.timesheetService.report(payload, token);
        submittedCount += 1;
      }
    }

    return submittedCount;
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
