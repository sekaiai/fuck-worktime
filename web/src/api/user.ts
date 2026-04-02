export interface AuthorizedUserProfile {
  phone: string;
  nickname: string;
}

export interface SaveAuthResponse {
  success: boolean;
  message: string;
  data?: AuthorizedUserProfile;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export async function saveAuthorizationToken(token: string): Promise<SaveAuthResponse> {
  const response = await fetch(`${API_BASE_URL}/user/save-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
    }),
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

  return data;
}
