import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { AutoFillConfig } from '../timesheet/scheduler/auto-fill.types';
import type { DingtalkLoginStatus } from './dto/user-info.dto';

export interface DingtalkUserRecord {
  userId: string;
  token: string;
  dingtalkCookies: Record<string, string>;
  nickname?: string;
  phone?: string;
  department?: string;
  updatedAt: string;
  autoFill?: AutoFillConfig | null;
  status: DingtalkLoginStatus;
}

const DATA_FILE = 'data/user-config.json';
const LEGACY_DATA_FILE = 'dingtalk-users.json';

@Injectable()
export class DingtalkStore {
  private readonly logger = new Logger(DingtalkStore.name);

  private get apiRootPath(): string {
    const cwd = process.cwd();
    if (path.basename(cwd) === 'api') {
      return cwd;
    }
    return path.resolve(cwd, 'api');
  }

  private get filePath(): string {
    return path.resolve(this.apiRootPath, DATA_FILE);
  }

  private get legacyFilePath(): string {
    return path.resolve(this.apiRootPath, LEGACY_DATA_FILE);
  }

  private async ensureFileExists(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      const legacyData = await this.readLegacyData();
      await fs.writeFile(this.filePath, `${JSON.stringify(legacyData, null, 2)}\n`, 'utf-8');
    }
  }

  async readAll(): Promise<Record<string, DingtalkUserRecord>> {
    await this.ensureFileExists();
    const content = await fs.readFile(this.filePath, 'utf-8');
    const trimmed = content.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, Partial<DingtalkUserRecord>>;
      return Object.fromEntries(
        Object.entries(parsed).map(([userId, record]) => [userId, this.normalizeRecord(userId, record)]),
      );
    } catch {
      this.logger.error(`Failed to parse ${DATA_FILE}`);
      return {};
    }
  }

  async upsertUser(record: DingtalkUserRecord): Promise<void> {
    const data = await this.readAll();
    data[record.userId] = {
      ...data[record.userId],
      ...record,
      autoFill: record.autoFill ?? data[record.userId]?.autoFill ?? null,
      status: record.status ?? data[record.userId]?.status ?? this.deriveStatus(record.token),
      updatedAt: new Date().toISOString(),
    };
    await this.writeAll(data);
    this.logger.log(`[DingtalkStore] User ${record.userId} persisted to ${DATA_FILE}`);
  }

  async getUser(userId: string): Promise<DingtalkUserRecord | null> {
    const data = await this.readAll();
    return data[userId] ?? null;
  }

  async getAutoFill(userId: string): Promise<AutoFillConfig | null> {
    const user = await this.getUser(userId);
    return user?.autoFill ?? null;
  }

  async getAllAutoFill(): Promise<AutoFillConfig[]> {
    const data = await this.readAll();
    return Object.values(data)
      .map((record) => record.autoFill ?? null)
      .filter((config): config is AutoFillConfig => config !== null);
  }

  async getUsersByStatus(status: DingtalkLoginStatus): Promise<DingtalkUserRecord[]> {
    const data = await this.readAll();
    return Object.values(data).filter((record) => record.status === status);
  }

  async updateUserStatus(userId: string, status: DingtalkLoginStatus): Promise<DingtalkUserRecord | null> {
    const data = await this.readAll();
    const current = data[userId];
    if (!current) {
      return null;
    }

    const nextRecord: DingtalkUserRecord = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };

    data[userId] = nextRecord;
    await this.writeAll(data);
    return nextRecord;
  }

  async setAutoFill(config: AutoFillConfig): Promise<void> {
    const data = await this.readAll();
    const current = data[config.userId];
    data[config.userId] = {
      userId: config.userId,
      token: current?.token ?? '',
      dingtalkCookies: current?.dingtalkCookies ?? {},
      nickname: current?.nickname ?? '',
      phone: current?.phone ?? '',
      department: current?.department ?? '',
      updatedAt: current?.updatedAt ?? new Date().toISOString(),
      autoFill: config,
      status: current?.status ?? this.deriveStatus(current?.token),
    };
    await this.writeAll(data);
  }

  async writeAll(data: Record<string, DingtalkUserRecord>): Promise<void> {
    await this.ensureFileExists();
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }

  private async readLegacyData(): Promise<Record<string, DingtalkUserRecord>> {
    try {
      await fs.access(this.legacyFilePath);
    } catch {
      return {};
    }

    try {
      const content = await fs.readFile(this.legacyFilePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) {
        return {};
      }

      const parsed = JSON.parse(trimmed) as Record<string, Partial<DingtalkUserRecord>>;
      return Object.fromEntries(
        Object.entries(parsed).map(([userId, record]) => [userId, this.normalizeRecord(userId, record)]),
      );
    } catch {
      this.logger.error(`Failed to parse ${LEGACY_DATA_FILE}`);
      return {};
    }
  }

  private normalizeRecord(userId: string, record: Partial<DingtalkUserRecord> | undefined): DingtalkUserRecord {
    return {
      userId: record?.userId ?? userId,
      token: record?.token ?? '',
      dingtalkCookies: record?.dingtalkCookies ?? {},
      nickname: record?.nickname ?? '',
      phone: record?.phone ?? '',
      department: record?.department ?? '',
      updatedAt: record?.updatedAt ?? new Date().toISOString(),
      autoFill: record?.autoFill ?? null,
      status: record?.status ?? this.deriveStatus(record?.token),
    };
  }

  private deriveStatus(token?: string): DingtalkLoginStatus {
    return token && token.trim() ? 'logged_in' : 'expired';
  }
}
