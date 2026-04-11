import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import type { AutoFillConfig } from './auto-fill.types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'auto-fill.json');

@Injectable()
export class AutoFillStore {
  private readonly logger = new Logger(AutoFillStore.name);
  private configs: Map<string, AutoFillConfig> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, '{}', 'utf-8');
        return;
      }
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, AutoFillConfig>;
      this.configs = new Map(Object.entries(parsed));
    } catch (error) {
      this.logger.error('Failed to load auto-fill config', error);
      this.configs = new Map();
    }
  }

  private save(): void {
    try {
      const obj: Record<string, AutoFillConfig> = {};
      this.configs.forEach((value, key) => {
        obj[key] = value;
      });
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save auto-fill config', error);
    }
  }

  get(userId: string): AutoFillConfig | null {
    return this.configs.get(userId) || null;
  }

  getAll(): AutoFillConfig[] {
    return Array.from(this.configs.values());
  }

  set(config: AutoFillConfig): void {
    this.configs.set(config.userId, config);
    this.save();
  }

  delete(userId: string): void {
    this.configs.delete(userId);
    this.save();
  }
}
