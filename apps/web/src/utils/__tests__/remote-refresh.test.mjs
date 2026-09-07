import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REMOTE_REFRESH_DELAY_MS, createDeferredRemoteRefresh } from '../remote-refresh.ts';

test('等待期内的多次刷新请求合并为最后一次刷新', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let nextTimerId = 0;
  let refreshCount = 0;

  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextTimerId;
    timers.set(id, { callback, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => {
    timers.delete(id);
  };

  try {
    const scheduleRefresh = createDeferredRemoteRefresh(async () => {
      refreshCount += 1;
    });

    const first = scheduleRefresh();
    const second = scheduleRefresh();

    assert.equal(timers.size, 1);
    const [{ callback, delay }] = timers.values();
    assert.equal(delay, REMOTE_REFRESH_DELAY_MS);
    callback();

    await Promise.all([first, second]);
    assert.equal(refreshCount, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
