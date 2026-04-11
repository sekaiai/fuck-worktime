import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

import type { AutoFillConfig } from './auto-fill.types';

@Injectable()
export class AutoFillStore {
  private readonly logger = new Logger(AutoFillStore.name);

  private get dataDir(): string {
    const cwd = process.cwd();
    const apiRoot = path.basename(cwd) === 'api' ? cwd : path.resolve(cwd, 'api');
    return path.join(apiRoot, 'data', 'auto-fill');
  }

  private getFilePath(userId: string): string {
    return path.join(this.dataDir, `${userId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async get(userId: string): Promise<AutoFillConfig | null> {
    try {
      const content = await fs.readFile(this.getFilePath(userId), 'utf-8');
      return JSON.parse(content) as AutoFillConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to read auto-fill config for ${userId}`, error);
      }
      return null;
    }
  }

  async getAll(): Promise<AutoFillConfig[]> {
    await this.ensureDir();

    try {
      const entries = await fs.readdir(this.dataDir, { withFileTypes: true });
      const configs = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map(async (entry) => {
            try {
              const content = await fs.readFile(path.join(this.dataDir, entry.name), 'utf-8');
              return JSON.parse(content) as AutoFillConfig;
            } catch (error) {
              this.logger.error(`Failed to parse auto-fill file ${entry.name}`, error);
              return null;
            }
          }),
      );

      return configs.filter((config): config is AutoFillConfig => config !== null);
    } catch (error) {
      this.logger.error('Failed to list auto-fill configs', error);
      return [];
    }
  }

  async set(config: AutoFillConfig): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(
      this.getFilePath(config.userId),
      `${JSON.stringify(config, null, 2)}\n`,
      'utf-8',
    );
  }

  async delete(userId: string): Promise<void> {
    try {
      await fs.unlink(this.getFilePath(userId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete auto-fill config for ${userId}`, error);
      }
    }
  }
}
