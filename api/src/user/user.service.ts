import { Injectable, Logger } from '@nestjs/common';

import { PingScheduler } from './ping.scheduler';
import { TimesClient } from './times.client';
import { SaveAuthDto } from './dto/save-auth.dto';
import {
  SaveAuthResponse,
  StoredUser,
  TokenResponse,
  UserLookupResponse,
  UserProfile,
} from './user.types';
import { UserStore } from './user.store';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userStore: UserStore,
    private readonly timesClient: TimesClient,
    private readonly pingScheduler: PingScheduler,
  ) {}

  // 测试代码，请不要删除
   async onModuleInit(){
    // const token = '*REMOVED-JWT*'
    // await this.saveAuth({token})
  }

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

      console.log({userProfile})

      const storedUser: StoredUser = {
        ...userProfile,
        authorization,
        updateTime: new Date().toISOString(),
        status: 'active',
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

  async getUserByPhone(phone: string): Promise<UserLookupResponse> {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      return {
        success: false,
        message: '手机号不能为空。',
      };
    }

    const user = await this.userStore.getUserByPhone(normalizedPhone);

    if (!user) {
      return {
        success: false,
        message: '未找到已授权用户。',
      };
    }

    return {
      success: true,
      message: '获取用户信息成功',
      data: {
        phone: user.phone,
        nickname: user.nickname,
        status: user.status,
      },
    };
  }

  async clearAuthByPhone(phone: string): Promise<UserLookupResponse> {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      return {
        success: false,
        message: '手机号不能为空。',
      };
    }

    const deleted = await this.userStore.deleteUserByPhone(normalizedPhone);

    if (!deleted) {
      return {
        success: false,
        message: '未找到需要清除的授权用户。',
      };
    }

    return {
      success: true,
      message: '授权已清除',
    };
  }

  async saveToken(token: string): Promise<TokenResponse> {
    const normalizedToken = token?.trim() ?? '';

    if (!normalizedToken) {
      return {
        success: false,
        message: 'Token 不能为空。',
      };
    }

    await this.userStore.saveToken(normalizedToken);

    return {
      success: true,
      message: 'Token 保存成功',
      data: {
        token: normalizedToken,
      },
    };
  }

  async getToken(): Promise<TokenResponse> {
    const token = await this.userStore.getToken();

    if (!token) {
      return {
        success: false,
        message: '未找到已保存的 Token。',
      };
    }

    return {
      success: true,
      message: '获取 Token 成功',
      data: {
        token,
      },
    };
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
      status: 'active',
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
