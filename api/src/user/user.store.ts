import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

import { StoredUser } from './user.types';

@Injectable()
export class UserStore {
  private readonly logger = new Logger(UserStore.name);

  private get apiRootPath() {
    const currentWorkingDirectory = process.cwd();

    if (path.basename(currentWorkingDirectory) === 'api') {
      return currentWorkingDirectory;
    }

    return path.resolve(currentWorkingDirectory, 'api');
  }

  private get filePath() {
    return path.resolve(this.apiRootPath, 'user.json');
  }

  async ensureFileExists() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]\n', 'utf-8');
    }
  }

  async readUsers(): Promise<StoredUser[]> {
    await this.ensureFileExists();

    const content = await fs.readFile(this.filePath, 'utf-8');
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      await fs.writeFile(this.filePath, '[]\n', 'utf-8');
      return [];
    }

    try {
      const parsedContent = JSON.parse(trimmedContent) as unknown;

      if (!Array.isArray(parsedContent)) {
        this.logger.error(`user.json content is not an array: ${this.filePath}`);
        return [];
      }

      return parsedContent
        .filter(this.isStoredUser)
        .map((user) => ({
          ...user,
          status: user.status ?? 'active',
        }));
    } catch (error) {
      this.logger.error(
        `Failed to parse user.json at ${this.filePath}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async upsertUser(user: StoredUser) {
    const users = await this.readUsers();
    const existingIndex = users.findIndex((item) => item.phone === user.phone);

    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }

    await this.writeUsers(users);
  }

  async getUserByPhone(phone: string) {
    const users = await this.readUsers();
    return users.find((item) => item.phone === phone) ?? null;
  }

  async deleteUserByPhone(phone: string) {
    const users = await this.readUsers();
    const nextUsers = users.filter((item) => item.phone !== phone);

    if (nextUsers.length === users.length) {
      return false;
    }

    await this.writeUsers(nextUsers);
    return true;
  }

  async updateUserStatus(phone: string, status: StoredUser['status']) {
    const user = await this.getUserByPhone(phone);

    if (!user) {
      return false;
    }

    await this.upsertUser({
      ...user,
      status,
      updateTime: new Date().toISOString(),
    });
    return true;
  }

  private async writeUsers(users: StoredUser[]) {
    await this.ensureFileExists();
    await fs.writeFile(this.filePath, `${JSON.stringify(users, null, 2)}\n`, 'utf-8');
  }

  private isStoredUser(value: unknown): value is StoredUser {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const user = value as Partial<StoredUser>;

    return (
      typeof user.phone === 'string' &&
      typeof user.nickname === 'string' &&
      typeof user.authorization === 'string' &&
      typeof user.updateTime === 'string'
    );
  }
}
