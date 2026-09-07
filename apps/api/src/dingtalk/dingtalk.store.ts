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

const DATA_FILE = './data/user-config.json';
const LEGACY_DATA_FILE = 'dingtalk-users.json';

@Injectable()
export class DingtalkStore {
  private readonly logger = new Logger(DingtalkStore.name);
  /**
   * 串行化所有写操作的 Promise 链。
   * 自动填报调度器、ping 调度器、登录写入、用户配置保存都会触发 read-modify-write，
   * 无锁会导致丢失更新（例如 lastExecutedAt 覆盖刚保存的 autoFill 配置）。
   */
  private writeChain: Promise<unknown> = Promise.resolve();

  private get apiRootPath(): string {
    return path.resolve(__dirname, '..', '..');
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
      await this.atomicWrite(JSON.stringify(legacyData, null, 2));
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
    } catch (error) {
      // 解析失败必须抛出，禁止以空对象继续 writeAll，否则会静默清空全部用户数据。
      // 同时备份损坏文件以便事后恢复。
      await this.backupCorruptFile(content);
      throw new Error(
        `解析 ${DATA_FILE} 失败：${error instanceof Error ? error.message : error}。已保存备份文件。`,
      );
    }
  }

  async upsertUser(record: DingtalkUserRecord): Promise<void> {
    return this.serializeWrite(async () => {
      const data = await this.safeReadAll();
      data[record.userId] = {
        ...data[record.userId],
        ...record,
        autoFill: record.autoFill ?? data[record.userId]?.autoFill ?? null,
        status: record.status ?? data[record.userId]?.status ?? this.deriveStatus(record.token),
        updatedAt: new Date().toISOString(),
      };
      await this.atomicWrite(JSON.stringify(data, null, 2));
      this.logger.log(`[DingtalkStore] 用户 ${record.userId} 已保存到 ${DATA_FILE}`);
    });
  }

  async getUser(userId: string): Promise<DingtalkUserRecord | null> {
    const data = await this.safeReadAll();
    return data[userId] ?? null;
  }

  async getAutoFill(userId: string): Promise<AutoFillConfig | null> {
    const user = await this.getUser(userId);
    return user?.autoFill ?? null;
  }

  async getAllAutoFill(): Promise<AutoFillConfig[]> {
    const data = await this.safeReadAll();
    return Object.values(data)
      .map((record) => record.autoFill ?? null)
      .filter((config): config is AutoFillConfig => config !== null);
  }

  async getUsersByStatus(status: DingtalkLoginStatus): Promise<DingtalkUserRecord[]> {
    const data = await this.safeReadAll();
    return Object.values(data).filter((record) => record.status === status);
  }

  async updateUserStatus(userId: string, status: DingtalkLoginStatus): Promise<DingtalkUserRecord | null> {
    return this.serializeWrite(async () => {
      const data = await this.safeReadAll();
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
      await this.atomicWrite(JSON.stringify(data, null, 2));
      return nextRecord;
    });
  }

  /**
   * 仅当 token 仍与校验开始时一致才更新状态，避免过时的后台校验覆盖刚完成的扫码登录。
   */
  async updateUserStatusIfTokenMatches(
    userId: string,
    expectedToken: string,
    status: DingtalkLoginStatus,
  ): Promise<DingtalkUserRecord | null> {
    return this.serializeWrite(async () => {
      const data = await this.safeReadAll();
      const current = data[userId];
      if (!current || current.token !== expectedToken) {
        return null;
      }

      const nextRecord: DingtalkUserRecord = {
        ...current,
        status,
        updatedAt: new Date().toISOString(),
      };

      data[userId] = nextRecord;
      await this.atomicWrite(JSON.stringify(data, null, 2));
      return nextRecord;
    });
  }

  async setAutoFill(config: AutoFillConfig): Promise<void> {
    return this.serializeWrite(async () => {
      const data = await this.safeReadAll();
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
      await this.atomicWrite(JSON.stringify(data, null, 2));
    });
  }

  async writeAll(data: Record<string, DingtalkUserRecord>): Promise<void> {
    return this.serializeWrite(async () => {
      await this.ensureFileExists();
      await this.atomicWrite(JSON.stringify(data, null, 2));
    });
  }

  /**
   * 串行化所有写操作：read-modify-write 之间不会交错，避免丢失更新。
   */
  private serializeWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(task, task);
    // 不让单次失败打断后续写操作
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * 读操作容忍文件暂时不可读/损坏，返回空对象以避免阻塞读路径。
   * 写路径仍会通过 readAll 抛错，避免以空数据覆写。
   */
  private async safeReadAll(): Promise<Record<string, DingtalkUserRecord>> {
    try {
      return await this.readAll();
    } catch (error) {
      this.logger.warn(
        `[DingtalkStore] 读取数据失败，已降级为空数据：${error instanceof Error ? error.message : error}`,
      );
      return {};
    }
  }

  /**
   * 原子写：写入临时文件后 rename 替换目标文件。
   * rename 在同一文件系统内是原子的，可避免写入中途崩溃留下半截 JSON。
   */
  private async atomicWrite(serialized: string): Promise<void> {
    const target = this.filePath;
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, `${serialized}\n`, 'utf-8');
    await fs.rename(tmp, target);
  }

  private async backupCorruptFile(content: string): Promise<void> {
    const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
    try {
      await fs.writeFile(backupPath, content, 'utf-8');
      this.logger.error(`[DingtalkStore] 损坏的数据文件已备份到 ${backupPath}`);
    } catch (error) {
      this.logger.error(
        `[DingtalkStore] 备份损坏文件失败：${error instanceof Error ? error.message : error}`,
      );
    }
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
      this.logger.error(`解析旧数据文件 ${LEGACY_DATA_FILE} 失败`);
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
