import { apiRequest, type ApiEnvelope } from './request';

export interface PushSubscriptionPayload {
  userId: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushTestResult {
  success: boolean;
  message: string;
  attempted: number;
  delivered: number;
  failed: number;
}

function unwrapApiResponse<T>(response: ApiEnvelope<T> | T): T {
  return typeof response === 'object' && response !== null && 'data' in response
    ? response.data
    : response;
}

export async function getPushPublicKey(): Promise<string> {
  const response = (await apiRequest<{ publicKey: string }>(
    '/push/public-key',
  )) as ApiEnvelope<{ publicKey: string }> | { publicKey: string };

  return unwrapApiResponse(response).publicKey;
}

export async function subscribePush(payload: PushSubscriptionPayload): Promise<void> {
  await apiRequest('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiRequest(`/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
  });
}

export async function sendPushTest(): Promise<PushTestResult> {
  const response = (await apiRequest<PushTestResult>('/push/test', {
    method: 'POST',
    body: JSON.stringify({
      title: '云上工时测试通知',
      body: '通知链路已触发，请检查设备是否收到提醒。',
      url: '/',
    }),
  })) as ApiEnvelope<PushTestResult> | PushTestResult;

  return unwrapApiResponse(response);
}
