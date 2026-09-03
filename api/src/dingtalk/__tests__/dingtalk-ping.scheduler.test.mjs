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

function createScheduler({ users, ping, refreshUserToken, updateUserStatus }) {
  const logs = [];
  const store = {
    getUsersByStatus: async () => users,
    updateUserStatus,
  };
  const timesClient = { ping };
  const dingtalkService = { refreshUserToken };
  const scheduler = new schedulerModule.DingtalkPingScheduler(store, timesClient, dingtalkService);

  scheduler.logger = {
    log: (message) => logs.push(`log:${message}`),
    warn: (message) => logs.push(`warn:${message}`),
    error: (message) => logs.push(`error:${message}`),
  };

  return { scheduler, logs };
}

test('心跳成功打印 HTTP 状态和脱敏后的上游响应内容', async () => {
  const updateUserStatus = async () => {
    throw new Error('不应更新用户状态');
  };
  const { scheduler, logs } = createScheduler({
    users: [createUser()],
    ping: async () => ({
      statusCode: 200,
      data: { code: 200, msg: '操作成功', data: { token: 'response-token' } },
    }),
    refreshUserToken: async () => {
      throw new Error('不应重登录');
    },
    updateUserStatus,
  });

  await scheduler.pingLoggedInUsers();

  assert.equal(logs.some((message) => message.includes('HTTP=200')), true);
  assert.equal(logs.some((message) => message.includes('操作成功')), true);
  assert.equal(logs.some((message) => message.includes('[REDACTED]')), true);
  assert.equal(logs.some((message) => message.includes('response-token')), false);
});

test('心跳失败后只自动重登录一次并重试心跳', async () => {
  const pingArguments = [];
  let refreshCount = 0;
  let updateCount = 0;
  const { scheduler, logs } = createScheduler({
    users: [createUser()],
    ping: async (authorization) => {
      pingArguments.push(authorization);
      if (pingArguments.length === 1) {
        const error = new Error('心跳请求失败（HTTP 401）');
        error.statusCode = 401;
        error.responseData = { code: 401, msg: '登录状态已失效' };
        throw error;
      }

      return { statusCode: 200, data: { code: 200, msg: '重试成功', data: null } };
    },
    refreshUserToken: async () => {
      refreshCount += 1;
      return 'refreshed-token';
    },
    updateUserStatus: async () => {
      updateCount += 1;
    },
  });

  await scheduler.pingLoggedInUsers();

  assert.deepEqual(pingArguments, ['Bearer old-token', 'Bearer refreshed-token']);
  assert.equal(refreshCount, 1);
  assert.equal(updateCount, 0);
  assert.equal(logs.some((message) => message.includes('登录状态已失效')), true);
  assert.equal(logs.some((message) => message.includes('重试成功')), true);
  assert.equal(logs.some((message) => message.includes('refreshed-token')), false);
});

test('空 token 也会触发一次自动重登录，重登录失败后标记 expired', async () => {
  let pingCount = 0;
  let refreshCount = 0;
  const updatedStatuses = [];
  const { scheduler, logs } = createScheduler({
    users: [createUser('user-empty', '  ')],
    ping: async () => {
      pingCount += 1;
      throw new Error('不应使用空 token 发请求');
    },
    refreshUserToken: async () => {
      refreshCount += 1;
      return null;
    },
    updateUserStatus: async (userId, status) => {
      updatedStatuses.push([userId, status]);
    },
  });

  await scheduler.pingLoggedInUsers();

  assert.equal(pingCount, 0);
  assert.equal(refreshCount, 1);
  assert.deepEqual(updatedStatuses, [['user-empty', 'expired']]);
  assert.equal(logs.some((message) => message.includes('本地没有可用 token')), true);
});

test('自动重登录后的心跳重试失败时标记 expired', async () => {
  let pingCount = 0;
  let updateCount = 0;
  const { scheduler } = createScheduler({
    users: [createUser()],
    ping: async () => {
      pingCount += 1;
      const error = new Error('上游不可用');
      error.statusCode = 503;
      throw error;
    },
    refreshUserToken: async () => 'refreshed-token',
    updateUserStatus: async (userId, status) => {
      assert.equal(userId, 'user-1');
      assert.equal(status, 'expired');
      updateCount += 1;
    },
  });

  await scheduler.pingLoggedInUsers();

  assert.equal(pingCount, 2);
  assert.equal(updateCount, 1);
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
    updateUserStatus: async () => {},
  });

  const firstRun = scheduler.pingLoggedInUsers();
  await pingReady;
  const secondRun = scheduler.pingLoggedInUsers();
  releasePing();
  await Promise.all([firstRun, secondRun]);

  assert.equal(pingCount, 1);
});
