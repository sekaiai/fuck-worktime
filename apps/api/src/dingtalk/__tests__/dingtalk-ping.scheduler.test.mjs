import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'scheduler-test-stubs',
      setup(buildContext) {
        const stubs = new Map([
          ['@nestjs/common', 'export const Injectable = () => (target) => target; export class Logger { log() {} warn() {} error() {} }'],
          ['@nestjs/schedule', 'export const Cron = () => () => {};'],
          ['./dingtalk.service', 'export class DingtalkService {}'],
          ['./dingtalk.store', 'export class DingtalkStore {}'],
          ['../user/times.client', 'export class TimesClient {}'],
        ]);

        buildContext.onResolve({ filter: /.*/ }, (args) => {
          if (!stubs.has(args.path)) {
            return undefined;
          }

          return { path: args.path, namespace: 'scheduler-test-stub' };
        });
        buildContext.onLoad({ filter: /.*/, namespace: 'scheduler-test-stub' }, (args) => ({
          contents: stubs.get(args.path),
          loader: 'ts',
        }));
      },
    },
  ],
  stdin: {
    contents: `
      export { DingtalkPingScheduler } from './api/src/dingtalk/dingtalk-ping.scheduler.ts';
    `,
    resolveDir: new URL('../../../../', import.meta.url).pathname,
    sourcefile: 'dingtalk-ping-scheduler-test-entry.ts',
    loader: 'ts',
  },
});

const schedulerModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

function createUser(userId = 'user-1', token = 'old-token') {
  return {
    userId,
    token,
    dingtalkCookies: {},
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'logged_in',
  };
}

function createScheduler({
  users,
  ping,
  getUserInfo = async () => ({ code: 200 }),
  refreshUserToken = async () => null,
  hasActiveInteractiveLogin = () => false,
  updateUserStatusIfTokenMatches = async () => null,
}) {
  const logs = [];
  const store = {
    getUsersByStatus: async () => users,
    updateUserStatusIfTokenMatches,
  };
  const timesClient = { ping, getUserInfo };
  const dingtalkService = { refreshUserToken, hasActiveInteractiveLogin };
  const scheduler = new schedulerModule.DingtalkPingScheduler(store, timesClient, dingtalkService);

  scheduler.logger = {
    log: (message) => logs.push(`log:${message}`),
    warn: (message) => logs.push(`warn:${message}`),
    error: (message) => logs.push(`error:${message}`),
  };

  return { scheduler, logs };
}

test('心跳成功打印 HTTP 状态和脱敏后的上游响应内容', async () => {
  const { scheduler, logs } = createScheduler({
    users: [createUser()],
    ping: async () => ({
      statusCode: 200,
      data: { code: 200, msg: '操作成功', data: { token: 'response-token' } },
    }),
    refreshUserToken: async () => {
      throw new Error('不应重登录');
    },
    updateUserStatusIfTokenMatches: async () => {
      throw new Error('不应更新用户状态');
    },
  });

  await scheduler.pingLoggedInUsers();

  assert.equal(logs.some((message) => message.includes('HTTP=200')), true);
  assert.equal(logs.some((message) => message.includes('操作成功')), true);
  assert.equal(logs.some((message) => message.includes('[REDACTED]')), true);
  assert.equal(logs.some((message) => message.includes('response-token')), false);
});

test('心跳发送失败只记录日志，不自动登录也不修改用户状态', async () => {
  let refreshCount = 0;
  let updateCount = 0;
  const { scheduler, logs } = createScheduler({
    users: [createUser()],
    ping: async () => {
      throw new Error('网络连接中断');
    },
    refreshUserToken: async () => {
      refreshCount += 1;
      return null;
    },
    updateUserStatusIfTokenMatches: async () => {
      updateCount += 1;
      return null;
    },
  });

  await scheduler.pingLoggedInUsers();

  assert.equal(refreshCount, 0);
  assert.equal(updateCount, 0);
  assert.equal(logs.some((message) => message.includes('心跳发送失败')), true);
});

test('每小时通过 getInfo 校验失败后只执行一次 Cookie 自动登录', async () => {
  const getInfoArguments = [];
  let refreshCount = 0;
  let updateCount = 0;
  const { scheduler } = createScheduler({
    users: [createUser()],
    ping: async () => ({ statusCode: 200, data: null }),
    getUserInfo: async (authorization) => {
      getInfoArguments.push(authorization);
      throw new Error('认证失败');
    },
    refreshUserToken: async () => {
      refreshCount += 1;
      return 'new-token';
    },
    updateUserStatusIfTokenMatches: async () => {
      updateCount += 1;
      return null;
    },
  });

  await scheduler.validateLoggedInUsers();

  assert.deepEqual(getInfoArguments, ['Bearer old-token']);
  assert.equal(refreshCount, 1);
  assert.equal(updateCount, 0);
});

test('每小时校验及 Cookie 自动登录均失败后才标记 expired', async () => {
  const updatedStatuses = [];
  const { scheduler } = createScheduler({
    users: [createUser()],
    ping: async () => ({ statusCode: 200, data: null }),
    getUserInfo: async () => {
      throw new Error('认证失败');
    },
    refreshUserToken: async () => null,
    updateUserStatusIfTokenMatches: async (userId, expectedToken, status) => {
      updatedStatuses.push([userId, expectedToken, status]);
      return { ...createUser(userId, expectedToken), status };
    },
  });

  await scheduler.validateLoggedInUsers();

  assert.deepEqual(updatedStatuses, [['user-1', 'old-token', 'expired']]);
});

test('后台校验结果过期时不会覆盖新的扫码登录状态', async () => {
  const { scheduler, logs } = createScheduler({
    users: [createUser()],
    ping: async () => ({ statusCode: 200, data: null }),
    getUserInfo: async () => {
      throw new Error('认证失败');
    },
    refreshUserToken: async () => null,
    updateUserStatusIfTokenMatches: async () => null,
  });

  await scheduler.validateLoggedInUsers();

  assert.equal(logs.some((message) => message.includes('忽略过期校验结果')), true);
});

test('前端扫码登录进行中时跳过每小时登录态校验', async () => {
  let getInfoCount = 0;
  const { scheduler } = createScheduler({
    users: [createUser()],
    ping: async () => ({ statusCode: 200, data: null }),
    getUserInfo: async () => {
      getInfoCount += 1;
    },
    hasActiveInteractiveLogin: () => true,
  });

  await scheduler.validateLoggedInUsers();

  assert.equal(getInfoCount, 0);
});

test('正在执行心跳时不会启动第二个调度周期', async () => {
  let releasePing;
  let pingStarted;
  const pingReady = new Promise((resolve) => {
    pingStarted = resolve;
  });
  const pingRelease = new Promise((resolve) => {
    releasePing = resolve;
  });
  let pingCount = 0;
  const { scheduler } = createScheduler({
    users: [createUser()],
    ping: async () => {
      pingCount += 1;
      pingStarted();
      await pingRelease;
      return { statusCode: 200, data: { code: 200, msg: '操作成功', data: null } };
    },
    refreshUserToken: async () => null,
  });

  const firstRun = scheduler.pingLoggedInUsers();
  await pingReady;
  const secondRun = scheduler.pingLoggedInUsers();
  releasePing();
  await Promise.all([firstRun, secondRun]);

  assert.equal(pingCount, 1);
});
