import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

import { DingtalkStore } from '../../dingtalk/dingtalk.store';
import type { AutoFillConfig } from './auto-fill.types';

@Injectable()
export class AutoFillStore {
  private readonly logger = new Logger(AutoFillStore.name);
  private migrationComplete = false;

  constructor(private readonly dingtalkStore: DingtalkStore) {}

  private get legacyDir(): string {
    const cwd = process.cwd();
    const apiRoot = path.basename(cwd) === 'api' ? cwd : path.resolve(cwd, 'api');
    return path.join(apiRoot, 'data', 'auto-fill');
  }

  async get(userId: string): Promise<AutoFillConfig | null> {
    await this.ensureLegacyMigration();
    return this.dingtalkStore.getAutoFill(userId);
  }

  async getAll(): Promise<AutoFillConfig[]> {
    await this.ensureLegacyMigration();
    return this.dingtalkStore.getAllAutoFill();
  }

  async set(config: AutoFillConfig): Promise<void> {
    await this.ensureLegacyMigration();
    await this.dingtalkStore.setAutoFill(config);
  }

  private async ensureLegacyMigration(): Promise<void> {
    if (this.migrationComplete) {
      return;
    }

    this.migrationComplete = true;

    try {
      const entries = await fs.readdir(this.legacyDir, { withFileTypes: true });
      const legacyFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
      if (legacyFiles.length === 0) {
        return;
      }

      const records = await this.dingtalkStore.readAll();

      for (const entry of legacyFiles) {
        try {
          const userId = entry.name.replace(/\.json$/i, '');
          const content = await fs.readFile(path.join(this.legacyDir, entry.name), 'utf-8');
          const config = JSON.parse(content) as AutoFillConfig;
          const existing = records[userId];

          records[userId] = {
            userId,
            token: existing?.token ?? '',
            dingtalkCookies: existing?.dingtalkCookies ?? {},
            updatedAt: existing?.updatedAt ?? new Date().toISOString(),
            autoFill: config,
            status: existing?.status ?? (existing?.token ? 'logged_in' : 'expired'),
          };
        } catch (error) {
          this.logger.error(`Failed to migrate legacy auto-fill file ${entry.name}`, error);
        }
      }

      await this.dingtalkStore.writeAll(records);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to migrate legacy auto-fill configs', error);
      }
    }
  }
}
