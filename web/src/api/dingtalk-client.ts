import { apiRequest } from './request';

export interface QrcodeResult {
  taskId: string;
  qrcode: string;
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
  const response = await apiRequest<{
    taskId: string;
    qrcode?: string;
    qrcodeBase64?: string;
  }>('/dingtalk/qrcode');

  return {
    taskId: response.data.taskId,
    qrcode: response.data.qrcode ?? response.data.qrcodeBase64 ?? '',
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
