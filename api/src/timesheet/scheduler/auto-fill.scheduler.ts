import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoFillStore } from './auto-fill.store';
import { TimesheetService } from '../timesheet.service';
import { AiService } from '../ai/ai.service';
import { PushDeliveryService } from '../../push/push-delivery.service';
import { DingtalkService } from '../../dingtalk/dingtalk.service';
import type { AutoFillConfig } from './auto-fill.types';
import axios from 'axios';

@Injectable()
export class AutoFillScheduler {
  private readonly logger = new Logger(AutoFillScheduler.name);
  private readonly timesApiBaseUrl = 'https://times.gzdata.com.cn:8099/prod-api';

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
    const configs = (await this.autoFillStore.getAll()).filter((c) => c.enabled && !c.expired);

    for (const config of configs) {
      try {
        await this.processUser(config);
      } catch (error) {
        this.logger.error(`Auto-fill failed for user ${config.userId}`, error);
      }
    }
  }

  private async processUser(config: AutoFillConfig): Promise<void> {
    if (config.deadline && new Date(config.deadline) < new Date()) {
      const updated = { ...config, expired: true };
      await this.autoFillStore.set(updated);
      this.logger.log(`User ${config.userId} auto-fill expired`);
      return;
    }

    const token = await this.getTokenForUser(config.userId);
    if (!token) {
      await this.notifyUser(config.userId, '自动填报失败：无法获取登录凭证，请重新登录');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const weekBoard = await this.getWeekBoard(today, token);
    if (!weekBoard) return;

    const todayData = (weekBoard as { data?: { days?: Array<{ date: string; isWeekend: boolean; status: string }> } }).data?.days?.find(
      (d) => d.date === today,
    );

    if (!todayData || todayData.isWeekend) {
      this.logger.log(`User ${config.userId}: today is weekend, skipping`);
      return;
    }

    if (todayData.status !== '未提交') {
      this.logger.log(`User ${config.userId}: today already submitted, skipping`);
      return;
    }

    const contents = await this.aiService.generateWorkContents(config.work, 1);
    const content = contents[0] || '日常工作处理';

    try {
      await this.submitReport(config, today, content, token);
      const updated: AutoFillConfig = {
        ...config,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'success',
      };
      await this.autoFillStore.set(updated);
      await this.notifyUser(config.userId, '今日工时已自动填报成功');
      this.logger.log(`User ${config.userId}: auto-fill success`);
    } catch (error) {
      const isAuthError = this.isAuthError(error);
      if (isAuthError) {
        const retryToken = await this.tryRecoverToken(config.userId);
        if (retryToken) {
          try {
            await this.submitReport(config, today, content, retryToken);
            const updated: AutoFillConfig = {
              ...config,
              lastExecutedAt: new Date().toISOString(),
              lastExecutionStatus: 'success',
            };
            await this.autoFillStore.set(updated);
            await this.notifyUser(config.userId, '今日工时已自动填报成功');
            return;
          } catch {
            // retry also failed
          }
        }
      }

      const updated: AutoFillConfig = {
        ...config,
        lastExecutedAt: new Date().toISOString(),
        lastExecutionStatus: 'failed',
      };
      await this.autoFillStore.set(updated);
      await this.notifyUser(config.userId, '今日工时自动填报失败，请手动处理');
      this.logger.error(`User ${config.userId}: auto-fill failed`, error);
    }
  }

  private async getTokenForUser(userId: string): Promise<string | null> {
    try {
      const userData = await this.dingtalkService.getUserByUserId(userId);
      return userData?.token || null;
    } catch {
      return null;
    }
  }

  private async getWeekBoard(date: string, token: string): Promise<unknown> {
    try {
      return await this.timesheetService.getWeekBoard(date, token);
    } catch {
      return null;
    }
  }

  private async submitReport(config: AutoFillConfig, date: string, content: string, token: string): Promise<void> {
    const url = `${this.timesApiBaseUrl}/working/timing/report`;
    await axios.post(
      url,
      {
        reportDate: date,
        projectId: config.projectId,
        projectTitle: config.projectTitle,
        projectStatus: config.projectStatus,
        itemId: config.itemId,
        content,
        hours: config.hours,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Referer: 'https://times.gzdata.com.cn:8099/hours/filling',
        },
      },
    );
  }

  private isAuthError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return error.response?.status === 401;
    }
    return false;
  }

  private async tryRecoverToken(userId: string): Promise<string | null> {
    try {
      return await this.dingtalkService.refreshUserToken(userId);
    } catch {
      return null;
    }
  }

  private async notifyUser(userId: string, message: string): Promise<void> {
    try {
      await this.pushService.sendNotificationToAll({
        title: '工时填报通知',
        body: message,
      });
    } catch (error) {
      this.logger.error('Failed to send notification', error);
    }
  }
}
