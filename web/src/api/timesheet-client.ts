import type { AutoFillConfig } from '../types/auto-fill';
import type {
  Project,
  ReportBatchRequest,
  TimesheetEntry,
  WeekBoardResponse,
  WorkTypeNode,
} from '../types/timesheet';
import { apiRequest, clearAuthToken, setAuthToken } from './request';

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
    if (Array.isArray(record.rows)) {
      return record.rows as T[];
    }
  }

  return [];
}

function unwrapObject<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in (value as Record<string, unknown>)) {
    return (value as { data: T }).data;
  }

  return value as T;
}

export { setAuthToken };

export function clearGzdataToken(): void {
  clearAuthToken();
}

export async function getWeekBoard(date: string): Promise<WeekBoardResponse> {
  const response = await apiRequest<WeekBoardResponse | { data?: WeekBoardResponse }>(
    `/timesheet/week-board?date=${encodeURIComponent(date)}`,
  );

  return unwrapObject<WeekBoardResponse>(response.data);
}

export async function getProjects(): Promise<Project[]> {
  const response = await apiRequest<unknown>('/timesheet/projects');
  return unwrapList<Record<string, unknown>>(response.data).map((project) => ({
    id: String(project.id ?? project.projectId ?? ''),
    title: String(project.title ?? project.projectTitle ?? project.name ?? ''),
    status: Number(project.status ?? project.projectStatus ?? 20),
  }));
}

export async function getWorkTypes(projectId: string): Promise<WorkTypeNode[]> {
  const response = await apiRequest<unknown>(
    `/timesheet/work-types?projectId=${encodeURIComponent(projectId)}`,
  );
  return unwrapList<WorkTypeNode>(response.data);
}

export async function generateContent(work: string, days: number): Promise<string[]> {
  const response = await apiRequest<string[]>('/timesheet/generate', {
    method: 'POST',
    body: JSON.stringify({ work, days }),
  });

  return response.data;
}

export async function submitBatch(body: ReportBatchRequest): Promise<{ code: number; msg: string }> {
  const response = await apiRequest<unknown>('/timesheet/report-batch', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    code: response.code,
    msg: response.msg,
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
