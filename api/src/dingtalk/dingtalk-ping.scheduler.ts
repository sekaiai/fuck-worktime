import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DingtalkService } from './dingtalk.service';
import { DingtalkStore, type DingtalkUserRecord } from './dingtalk.store';
import { TimesClient, type TimesPingResult } from '../user/times.client';

const SENSITIVE_LOG_KEY = /token|authorization|cookie|password|secret/i;
const SENSITIVE_LOG_VALUE = /bearer\s+\S+/gi;
const SENSITIVE_LOG_FIELD_VALUE = /(["']?(?:token|authorization|cookie|password|secret)["']?\s*[:=]\s*["']?)[^,"'\s}]+/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorProperty(error: unknown, property: string): unknown {
  if (!isRecord(error)) {
    return undefined;
  }

  return error[property];
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return '[truncated]';
  }

  if (typeof value === 'string') {
    return value
      .replace(SENSITIVE_LOG_VALUE, 'Bearer [REDACTED]')
      .replace(SENSITIVE_LOG_FIELD_VALUE, '$1[REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_LOG_KEY.test(key) ? '[REDACTED]' : sanitizeForLog(item, depth + 1),
      ]),
    );
  }

  return value;
}

function stringifyForLog(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForLog(value)) ?? 'null';
  } catch {
    return '[unserializable]';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function getErrorStatus(error: unknown): number | string {
  const statusCode = getErrorProperty(error, 'statusCode');
  return typeof statusCode === 'number' ? statusCode : '-';
}

function getErrorResponseData(error: unknown): unknown {
  return getErrorProperty(error, 'responseData') ?? null;
}

@Injectable()
export class DingtalkPingScheduler {
  private readonly logger = new Logger(DingtalkPingScheduler.name);
  private isRunning = false;

  constructor(
    private readonly dingtalkStore: DingtalkStore,
    private readonly timesClient: TimesClient,
    private readonly dingtalkService: DingtalkService,
  ) {}

  /**
   * 每 10 秒对 logged_in 用户做一次心跳，确认 token 仍然有效。
   * 心跳失败时使用已保存的钉钉 Cookie 自动登录一次，并立即重试心跳。
   */
  @Cron('*/10 * * * * *')
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

      const results = await Promise.allSettled(users.map((user) => this.checkUserHeartbeat(user)));

      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        this.logger.warn(`用户心跳检查完成，但有 ${rejectedCount} 个请求异常拒绝。`);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async checkUserHeartbeat(user: DingtalkUserRecord): Promise<void> {
    const token = user.token.trim();

    if (token) {
      try {
        const result = await this.timesClient.ping(`Bearer ${token}`);
        this.logPingResponse(user.userId, 'initial', result);
        return;
      } catch (error) {
        this.logPingFailure(user.userId, 'initial', error);
      }
    } else {
      this.logger.warn(`用户心跳失败：userId=${user.userId}，阶段=initial，原因=本地没有可用 token`);
    }

    let refreshedToken: string | null = null;
    try {
      this.logger.log(`用户心跳失败，开始自动重登录：userId=${user.userId}`);
      refreshedToken = await this.dingtalkService.refreshUserToken(user.userId);
    } catch (error) {
      this.logger.warn(`用户自动重登录异常：userId=${user.userId}，错误=${sanitizeForLog(getErrorMessage(error))}`);
    }

    if (!refreshedToken?.trim()) {
      await this.markExpired(user.userId, '自动重登录未返回有效 token');
      return;
    }

    try {
      const result = await this.timesClient.ping(`Bearer ${refreshedToken}`);
      this.logPingResponse(user.userId, 'retry', result);
    } catch (error) {
      this.logPingFailure(user.userId, 'retry', error);
      await this.markExpired(user.userId, '自动重登录后心跳重试失败');
    }
  }

  private logPingResponse(userId: string, attempt: 'initial' | 'retry', result: TimesPingResult): void {
    this.logger.log(
      `用户心跳响应：userId=${userId}，阶段=${attempt}，HTTP=${result.statusCode}，响应=${stringifyForLog(result.data)}`,
    );
  }

  private logPingFailure(userId: string, attempt: 'initial' | 'retry', error: unknown): void {
    this.logger.warn(
      `用户心跳失败：userId=${userId}，阶段=${attempt}，HTTP=${getErrorStatus(error)}，错误=${sanitizeForLog(getErrorMessage(error))}，响应=${stringifyForLog(getErrorResponseData(error))}`,
    );
  }

  private async markExpired(userId: string, reason: string): Promise<void> {
    try {
      await this.dingtalkStore.updateUserStatus(userId, 'expired');
      this.logger.warn(`用户登录状态已失效：userId=${userId}，原因=${reason}`);
    } catch (error) {
      this.logger.error(`更新用户失效状态失败：userId=${userId}，错误=${sanitizeForLog(getErrorMessage(error))}`);
    }
  }
}
