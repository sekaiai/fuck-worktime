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
      name: 'times-client-test-stubs',
      setup(buildContext) {
        const stubs = new Map([
          ['@nestjs/common', 'export const Injectable = () => (target) => target;'],
          ['axios', 'export default { create: () => ({ get: async () => ({ status: 200, data: {} }) }), isAxiosError: () => false };'],
          ['https', 'export class Agent {}'],
        ]);

        buildContext.onResolve({ filter: /.*/ }, (args) => {
          if (!stubs.has(args.path)) {
            return undefined;
          }

          return { path: args.path, namespace: 'times-client-test-stub' };
        });
        buildContext.onLoad({ filter: /.*/, namespace: 'times-client-test-stub' }, (args) => ({
          contents: stubs.get(args.path),
          loader: 'ts',
        }));
      },
    },
  ],
  stdin: {
    contents: `
      export { TimesClient, TimesClientError } from './api/src/user/times.client.ts';
    `,
    resolveDir: new URL('../../../../', import.meta.url).pathname,
    sourcefile: 'times-client-test-entry.ts',
    loader: 'ts',
  },
});

const clientModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);

function createClient(response) {
  const client = new clientModule.TimesClient();
  client.client = {
    get: async () => response,
  };
  return client;
}

test('getUserInfo 将 HTTP 200 + 业务 code 401 作为失败并保留上游响应', async () => {
  const responseData = {
    msg: '请求访问：/getInfo，认证失败，无法访问系统资源',
    code: 401,
  };
  const client = createClient({ status: 200, data: responseData });

  await assert.rejects(
    client.getUserInfo('Bearer test-token'),
    (error) => {
      assert.equal(error instanceof clientModule.TimesClientError, true);
      assert.equal(error.message, responseData.msg);
      assert.equal(error.statusCode, 200);
      assert.deepEqual(error.responseData, responseData);
      return true;
    },
  );
});

test('getUserInfo 接受业务成功码 200 和 0', async () => {
  for (const code of [200, 0]) {
    const responseData = { code, msg: '操作成功', user: { nickName: '测试用户' } };
    const client = createClient({ status: 200, data: responseData });

    assert.deepEqual(await client.getUserInfo('Bearer test-token'), responseData);
  }
});
