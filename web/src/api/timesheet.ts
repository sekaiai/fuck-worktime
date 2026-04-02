import { ref } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10002/api';

export interface Project {
  id: string;
  title: string;
}

export interface WorkType {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  children?: WorkType[];
}

export interface TimesheetEntry {
  reportDate: string;
  projectId: string;
  projectTitle: string;
  projectStatus?: number;
  itemId: string;
  content: string;
  hours: number;
}

export interface GenerateContentRequest {
  dayCount: number;
  maxChars?: number;
  description: string;
}

const gzdataToken = ref<string | null>(localStorage.getItem('gzdata_token'));

export function setGzdataToken(token: string) {
  gzdataToken.value = token;
  localStorage.setItem('gzdata_token', token);
}

export function getGzdataToken(): string | null {
  return gzdataToken.value;
}

export function clearGzdataToken() {
  gzdataToken.value = null;
  localStorage.removeItem('gzdata_token');
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = gzdataToken.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['x-gzdata-token'] = token;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetchApi<{ data: Project[] }>('/timesheet/projects');
  return response.data || [];
}

export async function getWorkTypes(projectId: string): Promise<WorkType[]> {
  const response = await fetchApi<{ data: WorkType[] }>(
    `/timesheet/work-types?projectId=${projectId}`
  );
  return response.data || [];
}

export async function submitTimesheet(
  entry: TimesheetEntry
): Promise<{ success: boolean; message: string }> {
  return fetchApi('/timesheet/submit', {
    method: 'POST',
    body: JSON.stringify({
      ...entry,
      projectStatus: entry.projectStatus || 30,
    }),
  });
}

export async function generateContent(
  request: GenerateContentRequest
): Promise<string[]> {
  const response = await fetchApi<{ data: string[] }>('/timesheet/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data || [];
}

export async function saveTokenToBackend(
  token: string
): Promise<{ success: boolean }> {
  return fetchApi('/user/token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function getTokenFromBackend(): Promise<{ token: string | null }> {
  return fetchApi('/user/token');
}
