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

const API_BASE = import.meta.env.PROD ? 'https://example.com/api' : 'http://localhost:10002/api';
// const API_BASE = 'https://w2.logacg.com/api'
let authToken = '';

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

export function getStoredUserId(): string | null {
  return getLocalStorage('userId');
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (authToken) {
    headers.set('x-gzdata-token', authToken);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

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
