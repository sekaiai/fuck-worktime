import type { AutoFillConfig } from '../types/auto-fill';
import type {
  Project,
  ReportBatchRequest,
  TimesheetEntry,
  WeekBoardResponse,
  WeekDay,
  WorkDetail,
  WorkTypeNode,
} from '../types/timesheet';
import { formatWeekRange } from '../utils/date';
import { ApiError, apiRequest, clearAuthToken, getApiBase, getAuthToken, setAuthToken } from './request';

const GZDATA_BASE = 'https://times.gzdata.com.cn:8099/prod-api';

/**
 * gzdata 慢响应或网络挂起时，没有超时会无限阻塞 authGate 之后的请求。
 * 默认 15 秒，与 request.ts 保持一致。
 */
const GZDATA_TIMEOUT_MS = 15_000;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeToken(token: string): string {
  const trimmed = token.trim().replace(/[\r\n]/g, '');
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function unwrapData<T>(value: unknown): T {
  if (isRecord(value) && 'data' in value) {
    return value.data as T;
  }

  return value as T;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (isRecord(payload)) {
    const msg = payload.msg;
    const message = payload.message;

    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

async function gzdataRawRequest(path: string, init?: RequestInit): Promise<unknown> {
  const token = getAuthToken();
  if (!token) {
    throw new ApiError('登录已失效，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json, text/plain, */*');
  headers.set('Authorization', normalizeToken(token));

  if (init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  // 若调用方未传 signal，则附加默认超时
  let signal = init?.signal;
  let cleanup: () => void = () => {};
  if (!signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GZDATA_TIMEOUT_MS);
    signal = controller.signal;
    cleanup = () => clearTimeout(timer);
  }

  let response: Response;
  try {
    response = await fetch(`${GZDATA_BASE}${path}`, {
      ...init,
      mode: 'cors',
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

  const payload = await parseJson<unknown>(response);

  if (response.status === 401) {
    throw new ApiError('登录已失效，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  if (!response.ok) {
    throw new ApiError(
      extractMessage(payload, `请求失败（${response.status}）`),
      response.status,
    );
  }

  if (isRecord(payload) && typeof payload.code === 'number') {
    if (payload.code === 401) {
      throw new ApiError(extractMessage(payload, '登录已失效，请重新登录'), 401, 'TOKEN_EXPIRED');
    }

    if (payload.code !== 200 && payload.code !== 0) {
      throw new ApiError(extractMessage(payload, '请求失败'), response.status);
    }
  }

  return payload;
}

async function gzdataRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const payload = await gzdataRawRequest(path, init);
  return unwrapData<T>(payload);
}

async function backendJsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
  });

  const payload = await parseJson<unknown>(response);

  if (response.status === 401) {
    throw new ApiError('登录已失效，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, `请求失败（${response.status}）`), response.status);
  }

  if (Array.isArray(payload)) {
    return payload as T;
  }

  if (isRecord(payload) && 'code' in payload && 'data' in payload) {
    if (payload.code === 401) {
      throw new ApiError(extractMessage(payload, '登录已失效，请重新登录'), 401, 'TOKEN_EXPIRED');
    }

    if (typeof payload.code === 'number' && payload.code !== 200 && payload.code !== 0) {
      throw new ApiError(extractMessage(payload, '请求失败'), response.status);
    }

    return payload.data as T;
  }

  return payload as T;
}

function normalizeWorkDetail(detail: unknown): WorkDetail {
  const record = isRecord(detail) ? detail : {};

  return {
    id: toStringValue(record.id ?? record.reportId ?? record.timingId),
    period: toStringValue(record.period ?? record.timeRange ?? record.reportTime ?? ''),
    hours: toNumberValue(record.hours ?? record.workHours),
    content: toStringValue(record.content ?? record.workContent ?? ''),
    status: toStringValue(record.status ?? record.statusName ?? ''),
    statusDesc: toStringValue(record.statusDesc ?? record.statusLabel ?? record.status ?? ''),
  };
}

function getWeekdayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[date.getDay()] ?? '';
}

function normalizeWeekDay(day: unknown): WeekDay {
  const record = isRecord(day) ? day : {};
  const detailsSource = record.details ?? record.detailList ?? record.workingTimingList ?? [];
  const details = Array.isArray(detailsSource) ? detailsSource.map(normalizeWorkDetail) : [];
  const date = toStringValue(record.date ?? record.reportDate);
  const totalHours = toNumberValue(
    record.totalHours ?? record.hours,
    details.reduce((sum, item) => sum + item.hours, 0),
  );

  return {
    date,
    dayOfWeek: toStringValue(record.dayOfWeek ?? record.weekDay ?? record.weekName, getWeekdayLabel(date)),
    isWeekend: Boolean(record.isWeekend),
    status: toStringValue(record.status ?? record.statusDesc ?? '未提交'),
    displayStatus: toStringValue(
      record.displayStatus ?? record.statusDesc ?? record.statusLabel ?? record.status,
      '',
    ),
    totalHours,
    details,
  };
}

function normalizeWeekBoard(value: unknown): WeekBoardResponse {
  const record = isRecord(value) ? value : {};
  const daysSource = Array.isArray(record.days) ? record.days : [];
  const days = daysSource.map(normalizeWeekDay).filter((day) => day.date);
  const totalHours = toNumberValue(
    record.totalHours ?? record.hours,
    days.reduce((sum, day) => sum + day.totalHours, 0),
  );

  return {
    days,
    weekRange: toStringValue(record.weekRange, formatWeekRange(days.map((day) => day.date))),
    totalHours,
    userName: toStringValue(record.userName ?? record.username, ''),
    deptName: toStringValue(record.deptName ?? record.departmentName, ''),
    weekNumber: toNumberValue(record.weekNumber, 0) || undefined,
    reportPeriod: toStringValue(record.reportPeriod, ''),
    currentWeek: toStringValue(record.currentWeek, ''),
  };
}

function normalizeProject(project: unknown): Project {
  const record = isRecord(project) ? project : {};

  return {
    id: toStringValue(record.id ?? record.projectId),
    title: toStringValue(record.title ?? record.projectTitle ?? record.name),
    projectStatus: toNumberValue(record.projectStatus, 20),
  };
}

function normalizeWorkType(node: unknown, parentId: string | null = null): WorkTypeNode {
  const record = isRecord(node) ? node : {};
  const id = toStringValue(record.id ?? record.itemId);
  const childrenSource = Array.isArray(record.children) ? record.children : [];

  return {
    id,
    name: toStringValue(record.name ?? record.title ?? record.itemName),
    level: toNumberValue(record.level, parentId ? 2 : 1),
    parentId,
    children: childrenSource.map((child) => normalizeWorkType(child, id)),
    extraFields: isRecord(record.extraFields)
      ? {
          selected: Boolean(record.extraFields.selected),
        }
      : undefined,
  };
}

function unwrapListSource(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    if (Array.isArray(value.rows)) {
      return value.rows;
    }

    if (Array.isArray(value.list)) {
      return value.list;
    }
  }

  return [];
}

export { setAuthToken };

export function clearGzdataToken(): void {
  clearAuthToken();
}

export async function getWeekBoard(date: string): Promise<WeekBoardResponse> {
  const payload = await gzdataRequest<unknown>(`/working/timing/week-board?date=${encodeURIComponent(date)}`);
  return normalizeWeekBoard(payload);
}

export async function getProjects(): Promise<Project[]> {
  const payload = await gzdataRequest<unknown>('/working/project/own-list');
  return unwrapListSource(payload)
    .map(normalizeProject)
    .filter((project) => project.id && project.title);
}

export async function getWorkTypes(projectId: string): Promise<WorkTypeNode[]> {
  const payload = await gzdataRequest<unknown>(
    `/admin/working-config/tree?projectId=${encodeURIComponent(projectId)}`,
  );

  return unwrapListSource(payload)
    .map((item) => normalizeWorkType(item))
    .filter((item) => item.id && item.name);
}

export async function generateContent(work: string, days: number): Promise<string[]> {
  const payload = await backendJsonRequest<unknown>('/timesheet/generate', {
    method: 'POST',
    body: JSON.stringify({ work, days }),
  });

  if (Array.isArray(payload)) {
    return payload.map((item) => toStringValue(item)).filter(Boolean);
  }

  return [];
}

export async function submitBatch(body: ReportBatchRequest): Promise<{ code: number; msg: string }> {
  const payload = await gzdataRawRequest('/working/timing/reportBatch', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (isRecord(payload) && typeof payload.code === 'number') {
    return {
      code: payload.code,
      msg: extractMessage(payload, payload.code === 200 ? '提交成功' : '提交失败'),
    };
  }

  return {
    code: 200,
    msg: '提交成功',
  };
}

export async function saveAutoFillConfig(
  config: Partial<AutoFillConfig> & { userId: string },
): Promise<{ code: number; msg: string }> {
  const response = await apiRequest('/timesheet/auto-fill', {
    method: 'POST',
    body: JSON.stringify(config),
  });

  return {
    code: response.code,
    msg: response.msg,
  };
}

export async function getAutoFillConfig(userId: string): Promise<AutoFillConfig | null> {
  const response = await apiRequest<AutoFillConfig | null>(
    `/timesheet/auto-fill?userId=${encodeURIComponent(userId)}`,
  );
  return response.data;
}

export async function disableAutoFill(userId: string): Promise<{ code: number; msg: string }> {
  const response = await apiRequest(`/timesheet/auto-fill?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

  return {
    code: response.code,
    msg: response.msg,
  };
}

export async function runAutoFillNow(userId: string): Promise<{ code: number; msg: string }> {
  const response = await apiRequest('/timesheet/auto-fill/run-now', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

  return {
    code: response.code,
    msg: response.msg,
  };
}

export function buildBatchPayload(entries: TimesheetEntry[]): ReportBatchRequest {
  return {
    workingTimingList: entries.map((entry) => ({
      reportDate: entry.reportDate,
      projectId: entry.projectId,
      projectTitle: entry.projectTitle,
      projectStatus: entry.projectStatus,
      itemId: entry.itemId,
      content: entry.content,
      hours: entry.hours,
    })),
  };
}
