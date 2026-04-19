import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';

import { DingtalkStore } from './dingtalk.store';
import { UserInfoData } from './dto/user-info.dto';
import { TimesClient } from '../user/times.client';

interface DingAuthResponse {
  msg: string;
  code: number;
  isSigned: string;
  userId: string;
  token: string;
}

interface LoginSession {
  taskId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  status: 'waiting' | 'success' | 'timeout' | 'error';
  userId: string | null;
  token: string | null;
  createdAt: number;
}

@Injectable()
export class DingtalkService {
  private readonly logger = new Logger(DingtalkService.name);
  private readonly sessions = new Map<string, LoginSession>();
  private readonly TIMEOUT_MS = 60000;
  private readonly LOGIN_BUTTON_SELECTORS = [
    '.app-page-curr div.module-confirm-button.base-comp-button.base-comp-button-type-primary:has-text("立即登录")',
    '.app-page-curr div.module-confirm-button:has-text("立即登录")'
  ];
  private readonly DINGTALK_AUTH_URL =
    'https://login.dingtalk.com/oauth2/challenge.htm?redirect_uri=https://times.gzdata.com.cn:8099/ding-talk-login&response_type=code&client_id=dinghuioeftyp2slxrcf&scope=openid&prompt=consent';

  constructor(
    private readonly dingtalkStore: DingtalkStore,
    private readonly timesClient: TimesClient,
  ) {}

  /**
   * 获取钉钉登录二维码
   * @returns 返回任务 ID、二维码 Base64 数据和登录状态
   *
   * 流程说明：
   * 1. 启动浏览器并隐藏自动化特征
   * 2. 创建页面，注册 ding-auth 响应监听（必须在任何导航之前）
   * 3. 导航到钉钉授权页
   * 4. 检测是否已登录（显示"立即登录"按钮）
   * 5. 如未登录，等待二维码渲染并截取
   * 6. 如已登录，点击按钮跳转，等待 ding-auth 响应
   * 7. 保存 userId、token 和钉钉 cookie 到本地 JSON
   */
  async getQrcode(userId?: string): Promise<{ taskId: string; qrcodeBase64: string; loginState: 'qrcode' | 'auto_login' }> {
    const taskId = randomUUID();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // ============================================
      // 步骤 1: 启动浏览器
      // ============================================
      this.logger.log('[步骤1] 启动浏览器');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      // ============================================
      // 步骤 2: 创建浏览器上下文
      // ============================================
      this.logger.log('[步骤2] 创建浏览器上下文');
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // 尝试恢复该用户在钉钉侧的登录态，减少重复扫码。
      await this.applyStoredCookies(context, userId);

      // 注入反检测脚本：移除 navigator.webdriver 属性
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      // ============================================
      // 步骤 3: 创建页面，并立即注册 ding-auth 响应监听
      // ============================================
      // ⚠️ 关键：必须在任何导航之前注册监听，否则会错过 ding-auth 响应
      this.logger.log('[步骤3] 创建页面并注册 ding-auth 监听');
      page = await context.newPage();

      // 创建 Promise 用于捕获 ding-auth 响应
      const dingAuthPromise = this.createDingAuthPromise(page, context);

      // ============================================
      // 步骤 4: 导航到钉钉授权页
      // ============================================
      this.logger.log('[步骤4] 导航到钉钉授权页');
      await page.goto(this.DINGTALK_AUTH_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      // ============================================
      // 步骤 5: 检测是否已登录
      // ============================================
      this.logger.log('[步骤5] 检测是否已登录');
      let isLoggedIn = false;
      let loginState: 'qrcode' | 'auto_login' = 'qrcode';

      for (const selector of this.LOGIN_BUTTON_SELECTORS) {
        const button = page.locator(selector);
        if (await button.count() > 0) {
          isLoggedIn = true;
          loginState = 'auto_login';
          this.logger.log('[步骤5] 检测到"立即登录"按钮，用户已登录');
          break;
        }
      }

      // ============================================
      // 步骤 6: 截取二维码（如果未登录）
      // ============================================
      let qrcodeBase64 = '';

      if (!isLoggedIn) {
        this.logger.log('[步骤6] 未登录，等待二维码渲染');
        // 等待钉钉二维码生成接口请求完成
        await page.waitForResponse(res =>
          res.url().includes('login.dingtalk.com/oauth2/generate_qrcode')
        );

        // 等待 300ms，确保 Canvas 渲染完成
        await page.waitForTimeout(300);

        const canvasLocator = page.locator('canvas');
        const hasCanvas = await canvasLocator.count() > 0;

        if (hasCanvas) {
          const screenshot = await canvasLocator.first().screenshot({ type: 'png' });
          qrcodeBase64 = screenshot.toString('base64');
          this.logger.log('[步骤6] 二维码截取成功（Canvas）');
        } else {
          const screenshot = await page.screenshot({ type: 'png' });
          qrcodeBase64 = screenshot.toString('base64');
          this.logger.log('[步骤6] 二维码截取成功（整页截图兜底）');
        }
      }

      // ============================================
      // 步骤 7: 创建登录会话
      // ============================================
      this.logger.log('[步骤7] 创建登录会话');
      const session: LoginSession = {
        taskId,
        browser,
        context,
        page,
        status: 'waiting',
        userId: null,
        token: null,
        createdAt: Date.now(),
      };
      this.sessions.set(taskId, session);

      // ============================================
      // 步骤 8: 如果已登录，点击按钮并启动登录监听
      // ============================================
      if (isLoggedIn) {
        if (!page) {
          throw new Error('Dingtalk page is not initialized');
        }
        this.logger.log('[步骤8] 已登录，点击登录按钮');
        // 点击登录按钮，触发跳转（ding-auth 请求会在跳转后发出）
        for (const selector of this.LOGIN_BUTTON_SELECTORS) {
          const button = page.locator(selector);
          if (await button.count() > 0) {
            await button.first().click();
            this.logger.log('[步骤8] 已点击登录按钮，等待 ding-auth 响应...');
            break;
          }
        }
        this.monitorLogin(taskId, dingAuthPromise);
      }

      // 如果未登录，启动登录监听（监听器已在步骤 3 注册）
      if (!isLoggedIn) {
        this.logger.log('[步骤8] 未登录，启动扫码登录监听');
        this.monitorLogin(taskId, dingAuthPromise);
      }

      return { taskId, qrcodeBase64, loginState };
    } catch (error) {
      this.logger.error(`获取二维码失败：${error}`);

      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch {}

      throw error;
    }
  }

  /**
   * 创建 ding-auth 响应监听 Promise
   * @param page - Playwright 页面对象
   * @param context - Playwright 浏览器上下文
   * @returns Promise，resolve 时返回 { userId, token } 或 null
   *
   * ⚠️ 必须在任何导航之前调用此方法，否则会错过响应
   *
   * 工作原理：
   * 钉钉扫码登录后，页面会跳转到 gzdata 的 ding-talk-login 页面，
   * 该页面会请求 /prod-api/ding-auth?authCode=xxx 接口，
   * 接口返回 { code: 200, userId: "xxx", token: "xxx" }。
   */
  private createDingAuthPromise(
    page: Page,
    context: BrowserContext,
  ): Promise<{ userId: string; token: string } | null> {

    console.log({page})
    return new Promise<{ userId: string; token: string } | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn('[ding-auth] 等待超时（15秒），未捕获到响应');
        cleanup();
        resolve(null);
      }, 150000);

      const responseHandler = async (response: import('playwright').Response) => {
        const url = response.url();
        console.log("URL:", url)
        if (!url.includes('/prod-api/ding-auth')) {
          return;
        }

        this.logger.log(`[ding-auth] 捕获到响应：${url}`);

        try {
          if (response.status() !== 200) {
            this.logger.warn(`[ding-auth] 状态码非 200：${response.status()}`);
            return;
          }

          const body = await response.json() as DingAuthResponse;
          this.logger.log(`[ding-auth] 响应体：code=${body.code}, userId=${body.userId}`);

          if (body.code !== 200 || !body.userId || !body.token) {
            this.logger.warn(`[ding-auth] 响应数据异常：${JSON.stringify(body)}`);
            return;
          }

          // 获取钉钉域名下的 Cookie
          const dingtalkCookies = await context.cookies(['https://login.dingtalk.com']);

          const cookieMap: Record<string, string> = {};
          for (const cookie of dingtalkCookies) {
            cookieMap[cookie.name] = cookie.value;
          }
          this.logger.log(`[ding-auth] 获取到 ${Object.keys(cookieMap).length} 个钉钉 Cookie`);

          // 保存到本地 JSON（以 userId 为键）
          const userProfile = await this.fetchUserProfile(body.token);

          await this.dingtalkStore.upsertUser({
            userId: body.userId,
            token: body.token,
            dingtalkCookies: cookieMap,
            nickname: userProfile.nickname,
            phone: userProfile.phone,
            department: userProfile.department,
            updatedAt: new Date().toISOString(),
          });

          this.logger.log(`[ding-auth] 用户 ${body.userId} 数据已保存`);

          cleanup();
          resolve({ userId: body.userId, token: body.token });
        } catch (error) {
          this.logger.error(`[ding-auth] 处理响应失败：${error}`);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        page.off('response', responseHandler);
      };

      // 注册监听器
      page.on('response', responseHandler);
      this.logger.log('[ding-auth] 监听器已注册');
    });
  }

  /**
   * 监听扫码登录状态
   * @param taskId - 任务 ID
   * @param dingAuthPromise - 已注册的 ding-auth 响应 Promise
   *
   * 监听机制：
   * 1. 设置 60 秒超时定时器
   * 2. 等待 dingAuthPromise 获取 userId 和 token
   * 3. 检测到登录成功后保存数据并清理资源
   */
  private async monitorLogin(taskId: string, dingAuthPromise: Promise<{ userId: string; token: string } | null>): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    this.logger.log(`[monitorLogin] 开始监听扫码登录，taskId=${taskId}`);

    // 设置超时定时器
    const timeout = setTimeout(async () => {
      if (session.status === 'waiting') {
        session.status = 'timeout';
        this.logger.warn(`[monitorLogin] 超时（60秒），taskId=${taskId}`);
        await this.cleanup(taskId);
      }
    }, this.TIMEOUT_MS);

    try {
      // 等待 ding-auth 响应
      const authResult = await dingAuthPromise;

      if (authResult) {
        session.status = 'success';
        session.userId = authResult.userId;
        session.token = authResult.token;
        this.logger.log(`[monitorLogin] 扫码登录成功：userId=${authResult.userId}`);
      } else {
        this.logger.warn(`[monitorLogin] ding-auth 未返回有效数据`);
      }

      clearTimeout(timeout);
      await this.cleanup(taskId);
    } catch (error) {
      this.logger.error(`[monitorLogin] 监听登录失败：${error}`);
      session.status = 'error';
      clearTimeout(timeout);
      await this.cleanup(taskId);
    }
  }

  /**
   * 获取登录会话状态
   * @param taskId - 任务 ID
   * @returns 返回会话状态、userId 和 token
   *
   * 状态说明：
   * - 'not_found': 会话不存在
   * - 'waiting': 等待用户扫码
   * - 'success': 登录成功
   * - 'timeout': 超时
   * - 'error': 错误
   */
  getStatus(taskId: string): { status: string; userId: string | null; token: string | null } {
    const session = this.sessions.get(taskId);
    if (!session) {
      return { status: 'not_found', userId: null, token: null };
    }
    return { status: session.status, userId: session.userId, token: session.token };
  }

  async getUserByUserId(userId: string): Promise<UserInfoData | null> {
    const record = await this.dingtalkStore.getUser(userId);
    if (!record) {
      return null;
    }

    return this.buildUserInfo(record);
  }

  async getUserByPhone(phone: string): Promise<UserInfoData | null> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return null;
    }

    const records = Object.values(await this.dingtalkStore.readAll());
    for (const record of records) {
      const userInfo = await this.buildUserInfo(record);
      if (this.normalizePhone(userInfo.phone) === normalizedPhone) {
        return userInfo;
      }
    }

    return null;
  }

  private async buildUserInfo(
    record: UserInfoData | { userId: string; token: string; updatedAt: string; nickname?: string; phone?: string; department?: string },
  ): Promise<UserInfoData> {
    try {
      const userProfile = await this.fetchUserProfile(record.token);

      return {
        userId: record.userId,
        token: record.token,
        nickname: userProfile.nickname,
        phone: userProfile.phone,
        department: userProfile.department,
        updatedAt: record.updatedAt,
      };
    } catch (error) {
      this.logger.warn(
        `getUserByUserId: 远程获取用户信息失败，userId=${record.userId}，${error instanceof Error ? error.message : error}`,
      );

      return {
        userId: record.userId,
        token: record.token,
        nickname: record.nickname ?? '',
        phone: record.phone ?? '',
        department: record.department ?? '',
        updatedAt: record.updatedAt,
      };
    }
  }

  private async fetchUserProfile(token: string): Promise<{ nickname: string; phone: string; department: string }> {
    const authorization = `Bearer ${token}`;
    const remoteResponse = await this.timesClient.getUserInfo(authorization);
    return this.extractUserInfo(remoteResponse);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  async refreshUserToken(userId: string): Promise<string | null> {
    const record = await this.dingtalkStore.getUser(userId);
    if (!record) {
      return null;
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      await this.applyStoredCookies(context, userId);

      page = await context.newPage();
      const dingAuthPromise = this.createDingAuthPromise(page, context);

      await page.goto(this.DINGTALK_AUTH_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      for (const selector of this.LOGIN_BUTTON_SELECTORS) {
        const button = page.locator(selector);
        if (await button.count() > 0) {
          await button.first().click();
          break;
        }
      }

      const authResult = await dingAuthPromise;
      return authResult?.token ?? null;
    } catch (error) {
      this.logger.warn(
        `refreshUserToken failed for ${userId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    } finally {
      await page?.close().catch(() => {});
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  }

  private extractUserInfo(response: unknown): { nickname: string; phone: string; department: string } {
    const envelope = this.asRecord(response);

    if (!envelope || envelope.code !== 200) {
      return { nickname: '', phone: '', department: '' };
    }

    const user = this.asRecord(envelope.user);
    if (!user) {
      return { nickname: '', phone: '', department: '' };
    }

    const nickname = this.pickString(user, ['nickName', 'nickname', 'userName']) ?? '';
    const phone = this.pickString(user, ['phonenumber', 'userName', 'phone']) ?? '';
    const department = this.pickString(user, ['deptName', 'department', 'deptId']) ?? '';

    return { nickname, phone, department };
  }

  private pickString(record: Record<string, unknown>, fields: string[]): string | null {
    for (const field of fields) {
      const value = record[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private async applyStoredCookies(context: BrowserContext, userId?: string): Promise<void> {
    if (!userId) {
      return;
    }

    const record = await this.dingtalkStore.getUser(userId);
    const cookieEntries = Object.entries(record?.dingtalkCookies ?? {});
    if (cookieEntries.length === 0) {
      this.logger.log(`[cookies] No stored dingtalk cookies for userId=${userId}`);
      return;
    }

    await context.addCookies(
      cookieEntries.map(([name, value]) => ({
        name,
        value,
        domain: '.dingtalk.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
      })),
    );
    this.logger.log(`[cookies] Applied ${cookieEntries.length} stored dingtalk cookies for userId=${userId}`);
  }

  /**
   * 清理浏览器资源
   * @param taskId - 任务 ID
   */
  private async cleanup(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    this.logger.log(`[cleanup] 清理会话：taskId=${taskId}, status=${session.status}`);

    try {
      // 暂时不关闭浏览器资源，保持窗口打开，方便调试
      await session.page.close().catch(() => {});
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
    } catch (error) {
      this.logger.error(`清理浏览器资源失败：${error}`);
    }

    // 30 秒后从内存中删除会话，便于后续状态查询
    setTimeout(() => {
      this.sessions.delete(taskId);
      this.logger.log(`[cleanup] 会话已删除：taskId=${taskId}`);
    }, 30000);
  }
}
