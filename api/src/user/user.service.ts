import { Injectable, Logger } from '@nestjs/common';

import { PingScheduler } from './ping.scheduler';
import { TimesClient } from './times.client';
import { SaveAuthDto } from './dto/save-auth.dto';
import { SaveAuthResponse, StoredUser, UserProfile } from './user.types';
import { UserStore } from './user.store';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userStore: UserStore,
    private readonly timesClient: TimesClient,
    private readonly pingScheduler: PingScheduler,
  ) {}

  async saveAuth(dto: SaveAuthDto): Promise<SaveAuthResponse> {
    const token = dto.token?.trim() ?? '';

    if (!token) {
      return {
        success: false,
        message: 'Token 不能为空。',
      };
    }

    const authorization = `Bearer ${token}`;

    try {
      const userInfoResponse = await this.timesClient.getUserInfo(authorization);
      const userProfile = this.extractUserProfile(userInfoResponse);

      const storedUser: StoredUser = {
        ...userProfile,
        authorization,
        updateTime: new Date().toISOString(),
      };

      await this.userStore.upsertUser(storedUser);
      await this.pingScheduler.ensureStarted();

      return {
        success: true,
        message: '授权成功',
        data: userProfile,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Token 无效或获取用户信息失败。';

      this.logger.warn(`Save auth failed: ${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  private extractUserProfile(response: unknown): UserProfile {
    const envelope = this.asRecord(response);

    if (!envelope) {
      throw new Error('远程接口返回格式无效。');
    }

    if (envelope.code !== 200) {
      const message = this.pickString(envelope, ['msg', 'message']) ?? 'Token 无效或获取用户信息失败。';
      throw new Error(message);
    }

    const user = this.asRecord(envelope.user);

    if (!user) {
      throw new Error('未获取到用户信息。');
    }

    const phone = this.pickString(user, ['phonenumber', 'userName', 'phone']) ?? '';
    const nickname = this.pickString(user, ['nickName', 'nickname', 'userName']) ?? '';

    if (!phone || !nickname) {
      throw new Error('已获取到远程响应，但未解析到手机号或昵称。');
    }

    return {
      phone,
      nickname,
    };
  }

  private pickString(record: Record<string, unknown>, fields: string[]) {
    for (const field of fields) {
      const value = record[field];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
