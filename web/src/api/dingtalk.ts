import type { UserInfo } from '../types/user';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10002/api';

export interface QrcodeResult {
  taskId: string;
  qrcode: string;
}

export interface LoginStatusResult {
  status: 'waiting' | 'success' | 'timeout' | 'error';
  userId?: string;
  token?: string;
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
  const res = await fetch(`${API_BASE}/dingtalk/qrcode`);
  if (!res.ok) throw new Error('获取二维码失败');
  return res.json();
}

export async function pollStatus(taskId: string): Promise<LoginStatusResult> {
  const res = await fetch(`${API_BASE}/dingtalk/status?taskId=${encodeURIComponent(taskId)}`);
  if (!res.ok) throw new Error('查询状态失败');
  return res.json();
}

export async function getUserByUserId(userId: string): Promise<{ code: number; msg: string; data: UserByUserIdResult | null }> {
  const res = await fetch(`${API_BASE}/dingtalk/user?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('获取用户信息失败');
  return res.json();
}
