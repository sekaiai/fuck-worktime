export interface AuthorizedUserProfile {
  phone: string;
  nickname: string;
  status: 'active' | 'expired';
}

export interface SaveAuthResponse {
  success: boolean;
  message: string;
  data?: AuthorizedUserProfile;
}

export interface UserLookupResponse {
  success: boolean;
  message: string;
  data?: AuthorizedUserProfile;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export async function saveAuthorizationToken(token: string): Promise<SaveAuthResponse> {
  return requestJson<SaveAuthResponse>(`${API_BASE_URL}/user/save-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
    }),
  });
}

export async function fetchAuthorizedUser(phone: string): Promise<UserLookupResponse> {
  const searchParams = new URLSearchParams({ phone });
  return requestJson<UserLookupResponse>(`${API_BASE_URL}/user/profile?${searchParams.toString()}`);
}

export async function clearAuthorizedUser(phone: string): Promise<UserLookupResponse> {
  return requestJson<UserLookupResponse>(
    `${API_BASE_URL}/user/auth/${encodeURIComponent(phone)}`,
    {
      method: 'DELETE',
    },
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
  });

  let data: SaveAuthResponse | null = null;

  try {
    data = (await response.json()) as SaveAuthResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message ?? `请求失败（${response.status}）`);
  }

  if (!data) {
    throw new Error('接口返回为空。');
  }

  return data as T;
}
