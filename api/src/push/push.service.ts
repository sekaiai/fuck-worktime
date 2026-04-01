import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { PushRegistration, PushMessage, PushResult } from './push.types';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly registrations = new Map<string, PushRegistration>();
  private readonly requestTimeoutMs = 30000;

  private readonly appId: string;
  private readonly appKey: string;
  private readonly masterSecret: string;
  private readonly apiUrl = 'https://restapi.getui.com/v2/$appId';

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('UNI_PUSH_APP_ID') ?? '';
    this.appKey = this.configService.get<string>('UNI_PUSH_APP_KEY') ?? '';
    this.masterSecret = this.configService.get<string>('UNI_PUSH_MASTER_SECRET') ?? '';

    if (this.appId && this.appKey && this.masterSecret) {
      this.logger.log('Uni-Push 配置已加载');
    } else {
      this.logger.warn('Uni-Push 配置不完整，推送功能已禁用。请配置 UNI_PUSH_APP_ID, UNI_PUSH_APP_KEY, UNI_PUSH_MASTER_SECRET');
    }
  }

  registerDevice(cid: string, platform: 'android' | 'ios' | 'web' = 'android', userId?: string): { success: boolean; count: number } {
    this.registrations.set(cid, {
      cid,
      userId,
      platform,
      createdAt: new Date(),
    });

    return {
      success: true,
      count: this.registrations.size,
    };
  }

  unregisterDevice(cid: string): { success: boolean; count: number } {
    const deleted = this.registrations.delete(cid);

    return {
      success: deleted,
      count: this.registrations.size,
    };
  }

  listRegistrations(): PushRegistration[] {
    return Array.from(this.registrations.values());
  }

  private async getAuthToken(): Promise<string> {
    const url = `https://restapi.getui.com/v2/${this.appId}/auth`;
    const timestamp = Date.now();
    const sign = this.generateSign(timestamp);

    const response = await axios.post(url, {
      sign,
      timestamp,
      appkey: this.appKey,
    }, {
      timeout: this.requestTimeoutMs,
    });

    if (response.data.code === 0) {
      return response.data.data.token;
    }

    throw new Error(`获取 Uni-Push Token 失败: ${response.data.msg}`);
  }

  private generateSign(timestamp: number): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(this.appKey + timestamp + this.masterSecret);
    return hash.digest('hex');
  }

  async sendMessage(message: PushMessage): Promise<PushResult> {
    if (!this.appId || !this.appKey || !this.masterSecret) {
      return {
        success: false,
        message: 'Uni-Push 配置不完整',
        attempted: 0,
        delivered: 0,
        failed: 0,
        errors: ['请配置 UNI_PUSH_APP_ID, UNI_PUSH_APP_KEY, UNI_PUSH_MASTER_SECRET'],
      };
    }

    const cids = message.cids ?? Array.from(this.registrations.keys());

    if (cids.length === 0) {
      return {
        success: false,
        message: '没有已注册的设备',
        attempted: 0,
        delivered: 0,
        failed: 0,
        errors: ['请先注册设备 CID'],
      };
    }

    this.logger.debug(`准备发送推送，设备数量: ${cids.length}`);

    try {
      const token = await this.getAuthToken();
      const url = `https://restapi.getui.com/v2/${this.appId}/push/single/cid`;

      const results = await Promise.allSettled(
        cids.map(async (cid) => {
          const response = await axios.post(url, {
            request_id: `${Date.now()}_${cid.substring(0, 8)}`,
            audience: {
              cid: [cid],
            },
            push_message: {
              notification: {
                title: message.title,
                body: message.content,
                click_type: 'intent',
                intent: message.payload?.url ?? '/',
              },
              transmission: message.payload ? JSON.stringify(message.payload) : undefined,
            },
          }, {
            headers: {
              'Content-Type': 'application/json',
              token,
            },
            timeout: this.requestTimeoutMs,
          });

          return response.data;
        }),
      );

      const delivered = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason;
          errors.push(`device[${index}]: ${error instanceof Error ? error.message : String(error)}`);
          this.logger.warn(`Push delivery failed for device ${index}: ${String(error)}`);
        }
      });

      return {
        success: delivered > 0,
        message: delivered > 0 ? '推送已发送' : '推送发送失败',
        attempted: cids.length,
        delivered,
        failed,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Push sending failed: ${errorMessage}`);

      return {
        success: false,
        message: '推送发送失败',
        attempted: cids.length,
        delivered: 0,
        failed: cids.length,
        errors: [errorMessage],
      };
    }
  }

  getDiagnosticInfo() {
    const registrations = Array.from(this.registrations.values());

    return {
      configured: !!(this.appId && this.appKey && this.masterSecret),
      appId: this.appId,
      appKey: this.appKey,
      registrationCount: registrations.length,
      platforms: registrations.reduce((acc, r) => {
        acc[r.platform] = (acc[r.platform] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      requestTimeoutMs: this.requestTimeoutMs,
    };
  }
}
