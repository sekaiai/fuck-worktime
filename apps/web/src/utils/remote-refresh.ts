export const REMOTE_REFRESH_DELAY_MS = 3_000;

/** 等待上游异步写入完成后，再静默读取最新数据。 */
export function waitForRemoteRefresh(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, REMOTE_REFRESH_DELAY_MS);
  });
}

type PendingRefresh = {
  resolve: () => void;
  reject: (reason: unknown) => void;
};

/** 合并等待期内的刷新请求；最后一次触发后仅执行一次刷新。 */
export function createDeferredRemoteRefresh(refresh: () => Promise<void>): () => Promise<void> {
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let pending: PendingRefresh[] = [];

  return () => new Promise<void>((resolve, reject) => {
    pending.push({ resolve, reject });
    if (timer !== null) {
      globalThis.clearTimeout(timer);
    }

    timer = globalThis.setTimeout(() => {
      timer = null;
      const currentPending = pending;
      pending = [];
      void Promise.resolve()
        .then(refresh)
        .then(
          () => currentPending.forEach((item) => item.resolve()),
          (error: unknown) => currentPending.forEach((item) => item.reject(error)),
        );
    }, REMOTE_REFRESH_DELAY_MS);
  });
}
