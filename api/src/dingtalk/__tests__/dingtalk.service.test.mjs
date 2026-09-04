import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'dingtalk-service-test-stubs',
      setup(buildContext) {
        const stubs = new Map([
          ['@nestjs/common', 'export const Injectable = () => (target) => target; export class Logger { log() {} warn() {} error() {} }'],
          ['playwright', 'export const chromium = { launch: async () => { throw new Error("不应启动浏览器"); } };'],
          ['crypto', 'export const randomUUID = () => "test-task-id";'],
          ['./dingtalk.store', 'export class DingtalkStore {}'],
          ['../user/times.client', 'export class TimesClient {}'],
        ]);

        buildContext.onResolve({ filter: /.*/ }, (args) => {
          if (!stubs.has(args.path)) {
            return undefined;
          }

          return { path: args.path, namespace: 'dingtalk-service-test-stub' };
        });
        buildContext.onLoad({ filter: /.*/, namespace: 'dingtalk-service-test-stub' }, (args) => ({
          contents: stubs.get(args.path),
          loader: 'ts',
        }));
      },
    },
  ],
  stdin: {
    contents: `
      export { DingtalkService } from './api/src/dingtalk/dingtalk.service.ts';
    `,
    resolveDir: new URL('../../../../', import.meta.url).pathname,
    sourcefile: 'dingtalk-service-test-entry.ts',
    loader: 'ts',
  },
});

const serviceModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);

test('/api/dingtalk/user 每次请求都从 gzbdgc 获取最新用户信息', async () => {
  const remoteRequests = [];
  const record = {
    userId: 'user-1',
    token: 'stored-token',
    dingtalkCookies: {},
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'refreshing',
  };
  const store = {
    getUser: async () => record,
    upsertUser: async () => {},
  };
  const timesClient = {
    getUserInfo: async (authorization) => {
      remoteRequests.push(authorization);
      return {
        code: 200,
        user: {
          nickName: '目标站点用户',
          phonenumber: '13800000000',
          deptName: '运维服务部',
        },
      };
    },
  };
  const service = new serviceModule.DingtalkService(store, timesClient);

  // 即使已有刷新任务，也不能跳过本次 /user 请求的上游查询。
  service.refreshPromises = new Map([
    ['user-1', Promise.resolve({ userId: 'user-1', token: 'stale-token', status: 'logged_in' })],
  ]);

  const first = await service.getUserByUserId('user-1');
  const second = await service.getUserByUserId('user-1');

  assert.deepEqual(remoteRequests, ['Bearer stored-token', 'Bearer stored-token']);
  assert.equal(first.nickname, '目标站点用户');
  assert.equal(second.department, '运维服务部');
});

test('/api/dingtalk/user 上游认证失败后进入自动重登录并使用新 token 重试', async () => {
  let currentToken = 'expired-token';
  const remoteRequests = [];
  const statuses = [];
  const record = {
    userId: 'user-2',
    token: currentToken,
    dingtalkCookies: {},
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'logged_in',
  };
  const store = {
    getUser: async () => ({ ...record, token: currentToken }),
    updateUserStatusIfTokenMatches: async (userId, expectedToken, status) => {
      assert.equal(userId, 'user-2');
      assert.equal(expectedToken, currentToken);
      statuses.push(status);
      return { ...record, token: currentToken, status };
    },
    upsertUser: async () => {},
  };
  const timesClient = {
    getUserInfo: async (authorization) => {
      remoteRequests.push(authorization);
      if (remoteRequests.length === 1) {
        throw new Error('请求访问：/getInfo，认证失败，无法访问系统资源');
      }

      return {
        code: 200,
        user: {
          nickName: '重登录用户',
          phonenumber: '13800000001',
          deptName: '运维服务部',
        },
      };
    },
  };
  const service = new serviceModule.DingtalkService(store, timesClient);
  service.refreshUserToken = async () => {
    currentToken = 'new-token';
    return currentToken;
  };

  const result = await service.getUserByUserId('user-2');

  assert.deepEqual(remoteRequests, ['Bearer expired-token', 'Bearer new-token']);
  assert.deepEqual(statuses, ['refreshing']);
  assert.equal(result.status, 'logged_in');
  assert.equal(result.nickname, '重登录用户');
});

test('/api/dingtalk/user 自动重登录失败后返回 expired', async () => {
  const statuses = [];
  const record = {
    userId: 'user-3',
    token: 'expired-token',
    dingtalkCookies: {},
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'logged_in',
  };
  const store = {
    getUser: async () => record,
    updateUserStatusIfTokenMatches: async (userId, expectedToken, status) => {
      assert.equal(userId, 'user-3');
      assert.equal(expectedToken, 'expired-token');
      statuses.push(status);
      return { ...record, status };
    },
  };
  const timesClient = {
    getUserInfo: async () => {
      throw new Error('请求访问：/getInfo，认证失败，无法访问系统资源');
    },
  };
  const service = new serviceModule.DingtalkService(store, timesClient);
  service.refreshUserToken = async () => null;

  const result = await service.getUserByUserId('user-3');

  assert.deepEqual(statuses, ['refreshing', 'expired']);
  assert.equal(result.status, 'expired');
  assert.equal(result.token, null);
});

test('过时的自动恢复结果不会覆盖扫码登录写入的新 token', async () => {
  const oldRecord = {
    userId: 'user-race',
    token: 'old-token',
    dingtalkCookies: {},
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'logged_in',
  };
  const newRecord = {
    ...oldRecord,
    token: 'new-token',
    status: 'logged_in',
  };
  const store = {
    getUser: async () => newRecord,
    updateUserStatusIfTokenMatches: async () => null,
  };
  const timesClient = {
    getUserInfo: async () => {
      throw new Error('旧 token 认证失败');
    },
  };
  const service = new serviceModule.DingtalkService(store, timesClient);

  const result = await service.doRefreshUserInfo(oldRecord);

  assert.equal(result.status, 'logged_in');
  assert.equal(result.token, 'new-token');
});

test('同一用户并发刷新 token 时复用同一个登录流程', async () => {
  let refreshCount = 0;
  let releaseRefresh;
  const refreshRelease = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  const service = new serviceModule.DingtalkService({}, {});
  service.doRefreshUserToken = async () => {
    refreshCount += 1;
    await refreshRelease;
    return 'new-token';
  };

  const first = service.refreshUserToken('user-lock');
  const second = service.refreshUserToken('user-lock');
  releaseRefresh();

  assert.deepEqual(await Promise.all([first, second]), ['new-token', 'new-token']);
  assert.equal(refreshCount, 1);
});
