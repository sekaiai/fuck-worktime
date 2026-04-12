import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { AutoFillConfig } from '../timesheet/scheduler/auto-fill.types';

export interface DingtalkUserRecord {
  userId: string;
  token: string;
  dingtalkCookies: Record<string, string>;
  updatedAt: string;
  autoFill?: AutoFillConfig | null;
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
      return JSON.parse(trimmed) as Record<string, DingtalkUserRecord>;
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

  async setAutoFill(config: AutoFillConfig): Promise<void> {
    const data = await this.readAll();
    const current = data[config.userId];
    data[config.userId] = {
      userId: config.userId,
      token: current?.token ?? '',
      dingtalkCookies: current?.dingtalkCookies ?? {},
      updatedAt: current?.updatedAt ?? new Date().toISOString(),
      autoFill: config,
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

      return JSON.parse(trimmed) as Record<string, DingtalkUserRecord>;
    } catch {
      this.logger.error(`Failed to parse ${LEGACY_DATA_FILE}`);
      return {};
    }
  }
}
