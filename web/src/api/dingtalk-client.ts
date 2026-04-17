import { apiRequest, getStoredUserId } from './request';

export interface QrcodeResult {
  taskId: string;
  qrcode: string;
  loginState: 'qrcode' | 'auto_login';
}

export interface LoginStatusResult {
  status: 'waiting' | 'success' | 'timeout' | 'error' | 'not_found';
  userId?: string | null;
  token?: string | null;
}

export interface UserByUserIdResult {
  userId: string;
  token: string;
  nickname: string;
  phone: string;
  department: string;
  updatedAt: string;
}

export async function getQrcode(): Promise<QrcodeResult> {
  const userId = getStoredUserId();
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await apiRequest<{
    taskId: string;
    qrcode?: string;
    qrcodeBase64?: string;
    loginState?: 'qrcode' | 'auto_login';
  }>(`/dingtalk/qrcode${query}`);

  return {
    taskId: response.data.taskId,
    qrcode: response.data.qrcode ?? response.data.qrcodeBase64 ?? '',
    loginState: response.data.loginState ?? 'qrcode',
  };
}

export async function pollStatus(taskId: string): Promise<LoginStatusResult> {
  const response = await apiRequest<LoginStatusResult>(
    `/dingtalk/status?taskId=${encodeURIComponent(taskId)}`,
  );
  return response.data;
}

export async function getUserByUserId(userId: string) {
  return apiRequest<UserByUserIdResult | null>(
    `/dingtalk/user?userId=${encodeURIComponent(userId)}`,
  );
}
