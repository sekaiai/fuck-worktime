import { onMounted, shallowRef } from 'vue';

interface ApiResponse {
  success?: boolean;
  message?: string;
  count?: number;
  configured?: boolean;
  appId?: string;
  registrationCount?: number;
  platforms?: Record<string, number>;
  delivered?: number;
  attempted?: number;
  failed?: number;
  errors?: string[];
}

interface GetuiSDK {
  init: (appId: string, appKey: string, accountId: string, callback: (result: { cid: string }) => void) => void;
  onMessage: (callback: (message: unknown) => void) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    GetuiSDK?: GetuiSDK;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = 10000;

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`请求失败（${response.status}）：${url}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs}ms）：${url}`);
    }

    throw error;
  } finally {
    window.clearTimeout(timerId);
  }
}

export function useUniPush() {
  const isLoading = shallowRef(false);
  const statusMessage = shallowRef('准备就绪，请注册设备以接收推送。');
  const cid = shallowRef<string>('');
  const registrationCount = shallowRef(0);
  const isConfigured = shallowRef(false);
  const sdkReady = shallowRef(false);

  let getuiSDK: GetuiSDK | null = null;

  async function fetchDiagnostic() {
    const data = await fetchJson<ApiResponse>(`${API_BASE_URL}/push/diagnostic`);
    isConfigured.value = data.configured ?? false;
    registrationCount.value = data.registrationCount ?? 0;
    return data;
  }

  async function initGetuiSDK(appId: string, appKey: string) {
    return new Promise((resolve, reject) => {
      if (!window.GetuiSDK) {
        reject(new Error('个推 Web SDK 未加载，请在 index.html 中引入 SDK 脚本'));
        return;
      }

      try {
        window.GetuiSDK.init(appId, appKey, 'default', (result: { cid: string }) => {
          if (result.cid) {
            cid.value = result.cid;
            sdkReady.value = true;
            statusMessage.value = `个推 SDK 初始化成功，CID: ${result.cid.substring(0, 8)}...`;
            resolve(result.cid);
          } else {
            reject(new Error('获取 CID 失败'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function registerDevice(deviceCid: string, platform: 'android' | 'ios' | 'web' = 'web', userId?: string) {
    isLoading.value = true;

    try {
      const data = await fetchJson<ApiResponse>(`${API_BASE_URL}/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cid: deviceCid,
        platform,
        userId,
      }),
      });

      if (data.success) {
        cid.value = deviceCid;
        statusMessage.value = `设备已注册，当前共 ${data.count} 个设备。`;
      } else {
        statusMessage.value = '设备注册失败。';
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '设备注册失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function unregisterDevice(deviceCid: string) {
    isLoading.value = true;

    try {
      const data = await fetchJson<ApiResponse>(`${API_BASE_URL}/push/register/${deviceCid}`, {
        method: 'DELETE',
      });

      if (data.success) {
        cid.value = '';
        statusMessage.value = `设备已注销，当前共 ${data.count} 个设备。`;
      } else {
        statusMessage.value = '设备注销失败。';
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '设备注销失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function sendMessage(title: string, content: string, payload?: Record<string, unknown>, targetCids?: string[]) {
    isLoading.value = true;

    try {
      const data = await fetchJson<ApiResponse>(`${API_BASE_URL}/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          payload,
          cids: targetCids,
        }),
      });

      if (data.success) {
        statusMessage.value = `推送已发送（送达 ${data.delivered}/${data.attempted}）。`;
      } else {
        statusMessage.value = `${data.message ?? '推送发送失败。'}（失败 ${data.failed ?? 0}）`;
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '推送发送失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function autoRegister() {
    if (!cid.value) {
      statusMessage.value = '无法自动注册：未获取到 CID。';
      return;
    }

    await registerDevice(cid.value, 'web');
  }

  onMounted(async () => {
    try {
      const diagnostic = await fetchDiagnostic();

      if (diagnostic.configured && diagnostic.appId) {
        const fullAppId = diagnostic.appId.replace('...', '');
        statusMessage.value = '正在初始化个推 Web SDK...';
      } else {
        statusMessage.value = 'Uni-Push 服务未配置，请检查后端环境变量。';
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '服务连接失败。';
    }
  });

  return {
    isConfigured,
    isLoading,
    statusMessage,
    cid,
    registrationCount,
    sdkReady,
    registerDevice,
    unregisterDevice,
    sendMessage,
    autoRegister,
  };
}
