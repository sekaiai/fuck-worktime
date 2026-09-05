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
  private isHeartbeatRunning = false;
  private isValidationRunning = false;

  constructor(
    private readonly dingtalkStore: DingtalkStore,
    private readonly timesClient: TimesClient,
    private readonly dingtalkService: DingtalkService,
  ) {}

  /**
   * 每 10 秒发送一次心跳。心跳只用于维持连接，不参与登录态判断。
   */
  @Cron('*/10 * * * * *')
  async pingLoggedInUsers(): Promise<void> {
    if (this.isHeartbeatRunning) {
      return;
    }

    this.isHeartbeatRunning = true;
    try {
      const users = await this.dingtalkStore.getUsersByStatus('logged_in');
      if (users.length === 0) {
        return;
      }

      const results = await Promise.allSettled(users.map((user) => this.sendHeartbeat(user)));

      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        this.logger.warn(`用户心跳检查完成，但有 ${rejectedCount} 个请求异常拒绝。`);
      }
    } finally {
      this.isHeartbeatRunning = false;
    }
  }

  /**
   * 每小时通过 /getInfo 校验一次登录态；失效后仅尝试一次 Cookie 自动登录。
   */
  @Cron('0 0 * * * *')
  async validateLoggedInUsers(): Promise<void> {
    if (this.isValidationRunning || this.dingtalkService.hasActiveInteractiveLogin()) {
      return;
    }

    this.isValidationRunning = true;
    try {
      const users = await this.dingtalkStore.getUsersByStatus('logged_in');
      const results = await Promise.allSettled(users.map((user) => this.validateUserSession(user)));
      const rejectedCount = results.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        this.logger.warn(`用户登录态校验完成，但有 ${rejectedCount} 个请求异常拒绝。`);
      }
    } finally {
      this.isValidationRunning = false;
    }
  }

  private async sendHeartbeat(user: DingtalkUserRecord): Promise<void> {
    const token = user.token.trim();
    if (!token) {
      this.logger.warn(`用户心跳未发送：userId=${user.userId}，原因=本地没有可用 token`);
      return;
    }

    try {
      const result = await this.timesClient.ping(`Bearer ${token}`);
      this.logPingResponse(user.userId, result);
    } catch (error) {
      this.logPingFailure(user.userId, error);
    }
  }

  private async validateUserSession(user: DingtalkUserRecord): Promise<void> {
    const token = user.token.trim();
    if (token) {
      try {
        await this.timesClient.getUserInfo(`Bearer ${token}`);
        this.logger.log(`用户登录态校验成功：userId=${user.userId}`);
        return;
      } catch (error) {
        this.logger.warn(
          `用户登录态校验失败：userId=${user.userId}，HTTP=${getErrorStatus(error)}，错误=${sanitizeForLog(getErrorMessage(error))}，响应=${stringifyForLog(getErrorResponseData(error))}`,
        );
      }
    } else {
      this.logger.warn(`用户登录态校验失败：userId=${user.userId}，原因=本地没有可用 token`);
    }

    // 前端正在扫码时不启动 Cookie 登录，避免两个 Playwright 登录流程互相竞争。
    if (this.dingtalkService.hasActiveInteractiveLogin()) {
      this.logger.log(`跳过自动重登录：userId=${user.userId}，原因=前端扫码登录正在进行`);
      return;
    }

    let refreshedToken: string | null = null;
    try {
      this.logger.log(`用户登录态已失效，开始 Cookie 自动重登录：userId=${user.userId}`);
      refreshedToken = await this.dingtalkService.refreshUserToken(user.userId);
    } catch (error) {
      this.logger.warn(`用户 Cookie 自动重登录异常：userId=${user.userId}，错误=${sanitizeForLog(getErrorMessage(error))}`);
    }

    if (refreshedToken?.trim()) {
      this.logger.log(`用户 Cookie 自动重登录成功：userId=${user.userId}`);
      return;
    }

    const expiredRecord = await this.dingtalkStore.updateUserStatusIfTokenMatches(
      user.userId,
      user.token,
      'expired',
    );
    if (expiredRecord) {
      this.logger.warn(`用户登录状态已失效：userId=${user.userId}，原因=Cookie 自动重登录失败`);
    } else {
      this.logger.log(`忽略过期校验结果：userId=${user.userId}，原因=用户 token 已被新的登录流程更新`);
    }
  }

  private logPingResponse(userId: string, result: TimesPingResult): void {
    this.logger.log(
      `用户心跳响应：userId=${userId}，HTTP=${result.statusCode}，响应=${stringifyForLog(result.data)}`,
    );
  }

  private logPingFailure(userId: string, error: unknown): void {
    this.logger.warn(
      `用户心跳发送失败：userId=${userId}，HTTP=${getErrorStatus(error)}，错误=${sanitizeForLog(getErrorMessage(error))}，响应=${stringifyForLog(getErrorResponseData(error))}`,
    );
  }
}
