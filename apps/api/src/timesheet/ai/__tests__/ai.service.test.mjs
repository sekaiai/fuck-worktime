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
      name: 'ai-service-test-stubs',
      setup(buildContext) {
        const stubs = new Map([
          ['@nestjs/common', 'export const Injectable = () => (target) => target; export class Logger { warn() {} error() {} }'],
          ['axios', 'export const calls = []; export const reset = () => { calls.length = 0; }; export default { post: async (...args) => { calls.push(args); return { data: { choices: [{ message: { content: "第一条生成内容\\n第二条生成内容" } }] } }; } };'],
        ]);

        buildContext.onResolve({ filter: /.*/ }, (args) => {
          if (!stubs.has(args.path)) {
            return undefined;
          }

          return { path: args.path, namespace: 'ai-service-test-stub' };
        });
        buildContext.onLoad({ filter: /.*/, namespace: 'ai-service-test-stub' }, (args) => ({
          contents: stubs.get(args.path),
          loader: 'ts',
        }));
      },
    },
  ],
  stdin: {
    contents: `
      export { AiService } from './api/src/timesheet/ai/ai.service.ts';
      export { calls, reset } from 'axios';
    `,
    resolveDir: new URL('../../../../../', import.meta.url).pathname,
    sourcefile: 'ai-service-test-entry.ts',
    loader: 'ts',
  },
});

const aiModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);

afterEach(() => {
  aiModule.reset();
});

function createService() {
  const config = {
    AI_API_URL: 'https://ai.example.test/v1/chat/completions',
    AI_API_KEY: 'test-key',
    AI_MODEL: 'test-model',
  };
  return new aiModule.AiService({ get: (key) => config[key] });
}

test('普通生成使用 AI 环境配置并要求随机 15-80 字内容', async () => {
  const service = createService();

  await service.generateWorkContents('完成联调', 2);

  const [url, body, options] = aiModule.calls[0];
  assert.equal(url, 'https://ai.example.test/v1/chat/completions');
  assert.equal(body.model, 'test-model');
  assert.equal(options.headers.Authorization, 'Bearer test-key');
  assert.equal(options.timeout, 90_000);
  assert.match(body.messages[0].content, /15～80 个中文字符/);
  assert.match(body.messages[0].content, /自然变化长短/);
});

test('上周参考生成使用相同配置并要求随机 15-80 字内容', async () => {
  const service = createService();

  await service.generateWorkContentsFromLastWeek(
    [{ weekday: '周一', content: '上周内容' }],
    ['周一'],
  );

  const [, body, options] = aiModule.calls[0];
  assert.equal(body.model, 'test-model');
  assert.equal(options.timeout, 90_000);
  assert.match(body.messages[0].content, /随机控制在15-80字之间/);
});
