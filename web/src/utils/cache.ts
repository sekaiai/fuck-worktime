const CACHE_PREFIX = 'yzgs_';

export function setCache<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    sessionStorage.setItem(CACHE_PREFIX + key, serialized);
  } catch {
    // ignore storage errors
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const serialized = sessionStorage.getItem(CACHE_PREFIX + key);
    if (serialized === null) return null;
    return JSON.parse(serialized) as T;
  } catch {
    return null;
  }
}

export function removeCache(key: string): void {
  sessionStorage.removeItem(CACHE_PREFIX + key);
}

export function clearAllCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

export function getProjectsCacheKey(userId: string): string {
  return `projects_${userId}`;
}

export function getWorkTypesCacheKey(projectId: string): string {
  return `worktypes_${projectId}`;
}

export function getLocalStorage(key: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + key);
}

export function setLocalStorage(key: string, value: string): void {
  localStorage.setItem(CACHE_PREFIX + key, value);
}

export function removeLocalStorage(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key);
}
