import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';

import { UserStore } from '../user/user.store';

interface LoginSession {
  taskId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  status: 'waiting' | 'success' | 'timeout' | 'error';
  token: string | null;
  createdAt: number;
}

@Injectable()
export class DingtalkService {
  private readonly logger = new Logger(DingtalkService.name);
  private readonly sessions = new Map<string, LoginSession>();
  private readonly TIMEOUT_MS = 60000;
  private readonly DINGTALK_AUTH_URL =
    'https://login.dingtalk.com/oauth2/challenge.htm?redirect_uri=https://times.gzdata.com.cn:8099/ding-talk-login&response_type=code&client_id=dinghuioeftyp2slxrcf&scope=openid&prompt=consent';

  constructor(
    private readonly userStore: UserStore,
  ) {}

  async getQrcode(): Promise<{ taskId: string; qrcodeBase64: string; loginState: 'qrcode' | 'auto_login' }> {
    const taskId = randomUUID();

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const existingToken = await this.userStore.getToken();
    if (existingToken) {
      await context.addCookies([
        {
          name: 'token',
          value: existingToken,
          domain: '.gzdata.com.cn',
          path: '/',
        },
        {
          name: 'Authorization',
          value: existingToken,
          domain: '.gzdata.com.cn',
          path: '/',
        },
      ]);
    }

    const page = await context.newPage();

    await page.goto(this.DINGTALK_AUTH_URL, { waitUntil: 'networkidle' });

    await page.waitForLoadState('networkidle');

    const loginButtonSelectors = [
      'button:has-text("立即登录")',
      'a:has-text("立即登录")',
      '[class*="login"]:has-text("立即登录")',
      'button:has-text("登录")',
    ];

    let isLoggedIn = false;
    let loginState: 'qrcode' | 'auto_login' = 'qrcode';

    for (const selector of loginButtonSelectors) {
      const button = page.locator(selector);
      if (await button.count() > 0) {
        isLoggedIn = true;
        loginState = 'auto_login';

        await button.first().click();

        await page.waitForURL('**/times.gzdata.com.cn/**', { timeout: 15000 }).catch(() => {});
        break;
      }
    }

    let qrcodeBase64 = '';

    if (!isLoggedIn) {
      const canvasLocator = page.locator('canvas');
      const hasCanvas = await canvasLocator.count() > 0;

      if (hasCanvas) {
        const screenshot = await canvasLocator.first().screenshot({ type: 'png' });
        qrcodeBase64 = screenshot.toString('base64');
      } else {
        const screenshot = await page.screenshot({ type: 'png' });
        qrcodeBase64 = screenshot.toString('base64');
      }
    }

    const session: LoginSession = {
      taskId,
      browser,
      context,
      page,
      status: isLoggedIn ? 'success' : 'waiting',
      token: null,
      createdAt: Date.now(),
    };

    if (isLoggedIn) {
      const cookies = await context.cookies();
      const tokenCookie = cookies.find(
        (c) => c.name === 'token' || c.name === 'Authorization' || c.name === 'jwt',
      );

      let tokenFromStorage: string | null = null;
      try {
        tokenFromStorage = await page.evaluate(() => {
          return localStorage.getItem('token') || localStorage.getItem('Authorization');
        });
      } catch {}

      const token = tokenCookie?.value || tokenFromStorage || '';

      if (token) {
        session.token = token;
        await this.userStore.saveToken(token);
      }
    }

    this.sessions.set(taskId, session);

    if (!isLoggedIn) {
      this.monitorLogin(taskId);
    }

    return { taskId, qrcodeBase64, loginState };
  }

  private async monitorLogin(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    const timeout = setTimeout(async () => {
      if (session.status === 'waiting') {
        session.status = 'timeout';
        await this.cleanup(taskId);
      }
    }, this.TIMEOUT_MS);

    try {
      session.page.on('framenavigated', async (frame) => {
        const url = frame.url();
        if (url.includes('times.gzdata.com.cn')) {
          const cookies = await session.context.cookies();
          const tokenCookie = cookies.find(
            (c) =>
              c.name === 'token' ||
              c.name === 'Authorization' ||
              c.name === 'jwt',
          );

          const urlObj = new URL(url);
          const tokenFromUrl = urlObj.searchParams.get('token');

          let tokenFromStorage: string | null = null;
          try {
            tokenFromStorage = await session.page.evaluate(() => {
              return (
                localStorage.getItem('token') ||
                localStorage.getItem('Authorization')
              );
            });
          } catch {
            // localStorage may not be accessible after navigation
          }

          const token =
            tokenCookie?.value || tokenFromUrl || tokenFromStorage || '';

          if (token) {
            session.status = 'success';
            session.token = token;
          }

          clearTimeout(timeout);
          await this.cleanup(taskId);
        }
      });

      session.page.on('response', async (response) => {
        const url = response.url();
        if (
          url.includes('times.gzdata.com.cn') &&
          response.status() === 200
        ) {
          try {
            const headers = response.headers();
            const setCookie = headers['set-cookie'] || '';
            if (
              setCookie.includes('token=') ||
              setCookie.includes('Authorization=')
            ) {
              const match = setCookie.match(
                /(?:token|Authorization)=([^;]+)/,
              );
              if (match) {
                session.status = 'success';
                session.token = match[1];
                clearTimeout(timeout);
                await this.cleanup(taskId);
              }
            }
          } catch {
            // response header parsing may fail
          }
        }
      });
    } catch (error) {
      this.logger.error(`监听登录失败: ${error}`);
      session.status = 'error';
      clearTimeout(timeout);
      await this.cleanup(taskId);
    }
  }

  getStatus(taskId: string): { status: string; token: string | null } {
    const session = this.sessions.get(taskId);
    if (!session) {
      return { status: 'not_found', token: null };
    }
    return { status: session.status, token: session.token };
  }

  private async cleanup(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    try {
      await session.page.close().catch(() => {});
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
    } catch (error) {
      this.logger.error(`清理浏览器资源失败: ${error}`);
    }

    setTimeout(() => {
      this.sessions.delete(taskId);
    }, 30000);
  }
}
