import type { WeekBoardResponse, Project, WorkTypeNode, TimesheetEntry, ReportBatchRequest } from '../types/timesheet';
import type { AutoFillConfig } from '../types/auto-fill';
import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../utils/cache';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10002/api';

function getGzdataToken(): string {
  return getLocalStorage('gzdata_token') || '';
}

export function setGzdataToken(token: string): void {
  setLocalStorage('gzdata_token', token);
}

export function clearGzdataToken(): void {
  removeLocalStorage('gzdata_token');
}

function authHeaders(): Record<string, string> {
  const token = getGzdataToken();
  return token ? { 'x-gzdata-token': token } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers as Record<string, string>,
    },
  });
  if (res.status === 401) {
    const error = new Error('TOKEN_EXPIRED');
    error.name = 'TokenExpiredError';
    throw error;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function getWeekBoard(date: string): Promise<WeekBoardResponse> {
  const data = await request<{ code: number; msg: string; data: WeekBoardResponse }>(`${API_BASE}/timesheet/week-board?date=${encodeURIComponent(date)}`);
  return data.data;
}

export async function getProjects(): Promise<Project[]> {
  const data = await request<{ code: number; msg: string; data: Project[] }>(`${API_BASE}/timesheet/projects`);
  return data.data;
}

export async function getWorkTypes(projectId: string): Promise<WorkTypeNode[]> {
  const data = await request<{ code: number; msg: string; data: WorkTypeNode[] }>(`${API_BASE}/timesheet/work-types?projectId=${encodeURIComponent(projectId)}`);
  return data.data;
}

export async function submitBatch(body: ReportBatchRequest): Promise<{ code: number; msg: string }> {
  return request<{ code: number; msg: string }>(`${API_BASE}/timesheet/report-batch`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function generateContent(work: string, days: number): Promise<string[]> {
  const data = await request<{ code: number; msg: string; data: string[] }>(`${API_BASE}/timesheet/generate`, {
    method: 'POST',
    body: JSON.stringify({ work, days }),
  });
  return data.data;
}

export async function getAutoFillConfig(userId: string): Promise<AutoFillConfig | null> {
  const data = await request<{ code: number; msg: string; data: AutoFillConfig | null }>(`${API_BASE}/timesheet/auto-fill?userId=${encodeURIComponent(userId)}`);
  return data.data;
}

export async function saveAutoFillConfig(config: Partial<AutoFillConfig> & { userId: string }): Promise<{ code: number; msg: string }> {
  return request<{ code: number; msg: string }>(`${API_BASE}/timesheet/auto-fill`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function disableAutoFill(userId: string): Promise<{ code: number; msg: string }> {
  return request<{ code: number; msg: string }>(`${API_BASE}/timesheet/auto-fill?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}
