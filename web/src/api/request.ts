import { getLocalStorage } from '../utils/cache';

export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

// 使用可选链：Vite dev/build 下 import.meta.env 恒存在，语义与直接取值一致；
// Node 测试环境（esbuild bundle 不注入 env）下安全回退到 PROD 分支。
const API_BASE = (import.meta.env.PROD ? 'https://fka.logacg.com/api' : 'http://localhost:10002/api');
let authToken = '';
let authGate: Promise<unknown> | null = null;

/**
 * 默认请求超时 15 秒，避免 gzdata 慢响应或网络挂起导致 authGate 后所有请求无限等待。
 * 调用方可通过 init.signal 自定义，但 fetch 的 signal 一旦由外部传入则不再自动追加超时。
 */
export const DEFAULT_TIMEOUT_MS = 15_000;

export function getApiBase(): string {
  return API_BASE;
}

export function setAuthToken(token: string): void {
  authToken = token.trim();
}

export function getAuthToken(): string {
  return authToken;
}

export function clearAuthToken(): void {
  authToken = '';
}

export function setAuthRequestGate(promise: Promise<unknown> | null): void {
  authGate = promise;
}

export function getStoredUserId(): string | null {
  return getLocalStorage('userId');
}

function shouldBypassAuthGate(path: string): boolean {
  return (
    path.startsWith('/dingtalk/user') ||
    path.startsWith('/dingtalk/user-by-phone') ||
    path.startsWith('/dingtalk/qrcode') ||
    path.startsWith('/dingtalk/status')
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('响应解析失败，请稍后重试。', response.status);
  }
}

/**
 * 创建带超时的 fetch 信号；若 init 已提供 signal 则原样返回，避免覆盖调用方控制。
 * timeoutMs 缺省时使用 DEFAULT_TIMEOUT_MS。
 */
export function createTimeoutSignal(
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (init?.signal) {
    return { signal: init.signal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/**
 * 从响应载荷中提取 data 字段；载荷不是带 data 字段的对象时（含 null、数组、原始值）原样返回。
 */
export function unwrapApiData<T>(value: unknown): T {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    return value.data as T;
  }

  return value as T;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  if (authGate && !shouldBypassAuthGate(path)) {
    await authGate.catch(() => undefined);
  }

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (authToken) {
    headers.set('x-gzdata-token', authToken);
  }

  const { signal, cleanup } = createTimeoutSignal(init);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal,
    });
  } catch (error) {
    cleanup();
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试。', undefined, 'TIMEOUT');
    }
    throw new ApiError(error instanceof Error ? error.message : '网络请求失败。');
  }
  cleanup();

  const payload = await parseResponse<ApiEnvelope<T> | { message?: string }>(response);
  if (response.status === 401) {
    throw new ApiError('登录已失效，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  if (!response.ok) {
    const message =
      'msg' in payload && typeof payload.msg === 'string'
        ? payload.msg
        : 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : `请求失败（${response.status}）`;
    throw new ApiError(message, response.status);
  }

  if ('code' in payload && payload.code === 401) {
    throw new ApiError(payload.msg || '登录已失效，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  return payload as ApiEnvelope<T>;
}
