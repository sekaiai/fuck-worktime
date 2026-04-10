import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface DingtalkUserRecord {
  userId: string;
  token: string;
  dingtalkCookies: Record<string, string>;
  updatedAt: string;
}

const DATA_FILE = 'dingtalk-users.json';

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

  private async ensureFileExists(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '{}\n', 'utf-8');
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
      ...record,
      updatedAt: new Date().toISOString(),
    };
    await this.writeAll(data);
    this.logger.log(`[DingtalkStore] 用户 ${record.userId} 数据已写入 ${DATA_FILE}`);
  }

  async getUser(userId: string): Promise<DingtalkUserRecord | null> {
    const data = await this.readAll();
    return data[userId] ?? null;
  }

  private async writeAll(data: Record<string, DingtalkUserRecord>): Promise<void> {
    await this.ensureFileExists();
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }
}
