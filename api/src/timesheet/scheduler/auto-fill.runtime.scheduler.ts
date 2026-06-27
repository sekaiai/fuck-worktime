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
  private readonly defaultReportTime = '17:00';

  constructor(
    private readonly autoFillStore: AutoFillStore,
    private readonly timesheetService: TimesheetService,
    private readonly aiService: AiService,
    private readonly pushService: PushDeliveryService,
    private readonly dingtalkService: DingtalkService,
  ) {}

  @Cron('0 * * * * *')
  async handleAutoFill(): Promise<void> {
    const configs = (await this.autoFillStore.getAll()).filter(
      (config) => config.enabled && !config.expired,
    );

    for (const config of configs) {
      if (!this.shouldRunNow(config)) {
        continue;
      }

      try {
        await this.processUser(config);
      } catch (error) {
        this.logger.error(`Auto-fill failed for user ${config.userId}`, error);
      }
    }
  }

  async triggerNow(userId: string): Promise<{ code: number; msg: string }> {
    const config = await this.autoFillStore.get(userId);
    if (!config) {
      return { code: 404, msg: 'Auto-fill config not found.' };
    }

    const normalizedConfig: AutoFillConfig = {
      ...config,
      reportTime: config.reportTime || this.defaultReportTime,
    };

    if (!normalizedConfig.enabled) {
      return { code: 400, msg: 'Auto-fill is disabled.' };
    }

    try {
      await this.processUser(normalizedConfig);
    } catch (error) {
      this.logger.error(`Manual auto-fill failed for user ${userId}`, error);
      return {
        code: 500,
        msg: error instanceof Error ? error.message : 'Manual auto-fill failed.',
      };
    }

    const latest = await this.autoFillStore.get(userId);
    switch (latest?.lastExecutionStatus) {
      case 'success':
        return { code: 200, msg: 'Auto-fill completed successfully.' };
      case 'skipped':
        return { code: 200, msg: 'No fillable workday is available right now.' };
      case 'expired':
        return { code: 200, msg: 'Auto-fill is expired and has stopped.' };
      case 'failed':
        return { code: 500, msg: 'Auto-fill failed. Please check the current config and login state.' };
      default:
        return { code: 200, msg: 'Auto-fill request finished.' };
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
      await this.notifyUser(config.userId, 'Auto-fill is expired and has stopped.');
      return;
    }

    const token = await this.getTokenForUser(config.userId);
    if (!token) {
      await this.markFailed(config, 'Failed to acquire token. Please log in again.');
      return;
    }

    const today = this.getTodayKey();
    const weekBoard = await this.getWeekBoard(today, token);
    if (!weekBoard) {
      await this.markFailed(config, 'Failed to fetch week board.');
      return;
    }

    const fillableDays = weekBoard
      .filter((day) => !day.isWeekend && day.status === '未提交' && day.date <= today)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (fillableDays.length === 0) {
      await this.markSkipped(config, 'No fillable workday is available this week.');
      return;
    }

    const contents = await this.aiService.generateWorkContents(
      config.work || 'Daily work handling',
      fillableDays.length,
    );

    const payloads = fillableDays.map<AutoFillReportPayload>((day, index) => ({
      reportDate: day.date,
      projectId: config.projectId,
      projectTitle: config.projectTitle,
      projectStatus: config.projectStatus,
      itemId: config.itemId,
      content: contents[index] || 'Daily work handling',
      hours: config.hours,
    }));

    try {
      const submittedCount = await this.submitReportsSequentially(config.userId, payloads, token);
      await this.autoFillStore.set({
        ...config,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      });
      await this.notifyUser(config.userId, `Auto-fill succeeded with ${submittedCount} submitted entries.`);
    } catch (error) {
      await this.markFailed(config, 'Auto-fill failed. Please handle the remaining entries manually.');
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

  /**
   * 显式按 Asia/Shanghai 时区生成 YYYY-MM-DD，避免依赖服务器本地时区。
   * 部署到非东八区时，"今天"、"reportTime 比较"与"day.date <= today"必须仍以中国时区为准。
   */
  private getTodayKey(): string {
    return this.formatShanghaiDate(new Date());
  }

  private formatShanghaiDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

  private getShanghaiHourMinute(): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    // Intl 在午夜可能返回 "24" 而非 "00"
    const normalizedHour = hour === '24' ? '00' : hour;
    return `${normalizedHour}:${minute}`;
  }

  private shouldRunNow(config: AutoFillConfig): boolean {
    const now = new Date();
    const today = this.formatShanghaiDate(now);
    const currentTime = this.getShanghaiHourMinute();
    const reportTime = config.reportTime || this.defaultReportTime;
    const lastExecutedDay = config.lastExecutedAt ? this.formatShanghaiDate(new Date(config.lastExecutedAt)) : null;

    if (lastExecutedDay === today) {
      return false;
    }

    return currentTime >= reportTime;
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
        title: 'Timesheet Notification',
        body: message,
        url: '/',
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for user ${userId}`, error);
    }
  }
}
