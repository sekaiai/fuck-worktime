const CACHE_PREFIX = 'yzgs_';
const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionCachePayload<T> {
  expiresAt: number;
  value: T;
}

export function getProjectsCacheKey(userId: string): string {
  return `projects_v2_${userId}`;
}

export function getWorkTypesCacheKey(projectId: string): string {
  return `worktypes_${projectId}`;
}

export function setSessionCache<T>(key: string, value: T, ttlMs = SESSION_TTL_MS): void {
  try {
    const payload: SessionCachePayload<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function getSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) {
      return null;
    }

    const payload = JSON.parse(raw) as SessionCachePayload<T>;
    if (payload.expiresAt < Date.now()) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return payload.value;
  } catch {
    return null;
  }
}

export const getCache = getSessionCache;
export const setCache = setSessionCache;

export function removeSessionCache(key: string): void {
  sessionStorage.removeItem(CACHE_PREFIX + key);
}

export function clearSessionCache(): void {
  const keysToRemove: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

export const clearAllCache = clearSessionCache;

export function getLocalStorage(key: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + key);
}

export function setLocalStorage(key: string, value: string): void {
  localStorage.setItem(CACHE_PREFIX + key, value);
}

export function removeLocalStorage(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key);
}
