import { computed, onMounted, shallowRef } from 'vue';

interface ApiResponse {
  success?: boolean;
  publicKey?: string;
  message?: string;
  attempted?: number;
  delivered?: number;
  failed?: number;
  removed?: number;
  errors?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = 10000;
const TEST_REQUEST_TIMEOUT_MS = 20000;
const SW_READY_TIMEOUT_MS = 12000;

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function detectBrowserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) {
    return 'Edge';
  }
  if (/OPR\//i.test(userAgent)) {
    return 'Opera';
  }
  if (/Firefox\//i.test(userAgent)) {
    return 'Firefox';
  }
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent) && !/CriOS\//i.test(userAgent)) {
    return 'Safari';
  }
  if (/Chrome\//i.test(userAgent) || /CriOS\//i.test(userAgent)) {
    return 'Chrome';
  }

  return '未知浏览器';
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const standaloneNavigator = navigator as NavigatorWithStandalone;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}

function getEnvironmentHint(browserName: string, isStandalone: boolean) {
  if (browserName === 'Safari' && !isStandalone) {
    return 'Safari 需要先将页面添加到主屏幕，再从主屏图标打开应用后才能完整使用离线通知。';
  }

  if (browserName === 'Firefox') {
    return 'Firefox 通常可直接测试 Web Push；若未收到通知，请先确认系统通知权限已开启。';
  }

  if (browserName === 'Chrome') {
    return '当前阶段优先验证非 Chrome 浏览器，Chrome 可作为补充参考。';
  }

  return '请确认当前浏览器允许通知，并使用 HTTPS 或本地开发环境访问。';
}

function base64ToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timerId);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timerId);
        reject(error);
      });
  });
}

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

export function usePushNotifications() {
  const isLoading = shallowRef(false);
  const statusMessage = shallowRef('准备就绪，请先授予通知权限。');
  const permissionState = shallowRef<NotificationPermission>(
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  );
  const currentSubscription = shallowRef<PushSubscription | null>(null);
  const browserName = shallowRef(
    typeof navigator === 'undefined' ? '未知浏览器' : detectBrowserName(navigator.userAgent),
  );
  const isStandalone = shallowRef(isStandaloneDisplayMode());
  const environmentHint = shallowRef(
    getEnvironmentHint(browserName.value, isStandalone.value),
  );

  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  );

  const hasSubscription = computed(() => currentSubscription.value !== null);
  const isNonChromeBrowser = computed(() => browserName.value !== 'Chrome');
  const canSubscribe = computed(
    () =>
      isSupported.value &&
      permissionState.value !== 'denied' &&
      !hasSubscription.value,
  );

  const isPermissionDenied = computed(() => permissionState.value === 'denied');
  const needsStandalone = computed(
    () => browserName.value === 'Safari' && !isStandalone.value,
  );

  async function getRegistration() {
    const existingRegistration = await navigator.serviceWorker.getRegistration();

    if (existingRegistration) {
      return existingRegistration;
    }

    return withTimeout(
      navigator.serviceWorker.ready,
      SW_READY_TIMEOUT_MS,
      `Service Worker 在 ${SW_READY_TIMEOUT_MS}ms 内未就绪，请确认前端已成功注册 SW。`,
    );
  }

  async function fetchPublicKey() {
    const data = await fetchJson<ApiResponse>(`${API_BASE_URL}/push/public-key`);

    if (!data.publicKey) {
      throw new Error('后端缺少 VAPID_PUBLIC_KEY 配置。');
    }

    return data.publicKey;
  }

  async function subscribe() {
    if (!isSupported.value) {
      statusMessage.value = '当前浏览器不支持 Web Push。';
      return;
    }

    if (needsStandalone.value) {
      statusMessage.value =
        '请先将页面添加到主屏幕，并从主屏图标打开应用后再创建订阅。';
      return;
    }

    isLoading.value = true;

    try {
      permissionState.value = await Notification.requestPermission();
      isStandalone.value = isStandaloneDisplayMode();
      environmentHint.value = getEnvironmentHint(browserName.value, isStandalone.value);

      if (permissionState.value !== 'granted') {
        statusMessage.value = '未授予通知权限，无法创建订阅。';
        return;
      }

      const publicKey = await fetchPublicKey();
      const registration = await getRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });

      currentSubscription.value = subscription;

      await fetchJson<ApiResponse>(`${API_BASE_URL}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      statusMessage.value = '订阅成功，设备信息已保存到后端。';
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '创建订阅失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function sendTestNotification() {
    isLoading.value = true;

    try {
      const data = await fetchJson<ApiResponse>(
        `${API_BASE_URL}/push/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: '云上工时测试通知',
            body: '前后端链路正常，已触发推送。',
            url: '/',
          }),
        },
        TEST_REQUEST_TIMEOUT_MS,
      );

      statusMessage.value = data.success
        ? `测试推送已发送（送达 ${data.delivered ?? 0}/${data.attempted ?? 0}）。请查看系统通知。`
        : `${data.message ?? '测试推送未送达。'}（送达 ${data.delivered ?? 0}/${
            data.attempted ?? 0
          }，失败 ${data.failed ?? 0}）`;
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '测试推送失败。';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(async () => {
    isStandalone.value = isStandaloneDisplayMode();
    environmentHint.value = getEnvironmentHint(browserName.value, isStandalone.value);

    if (!isSupported.value) {
      statusMessage.value = '当前浏览器不支持 Service Worker 或 Push API。';
      return;
    }

    if (permissionState.value === 'denied') {
      statusMessage.value = '通知权限已被拒绝。请在浏览器地址栏左侧点击锁图标，将通知权限改为"允许"后刷新页面。';
      return;
    }

    if (needsStandalone.value) {
      statusMessage.value =
        '请先将页面添加到主屏幕，并从主屏图标打开应用后再测试 Safari 的离线通知。';
      return;
    }

    try {
      const registration = await getRegistration();
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        currentSubscription.value = existingSubscription;
        // 同步订阅到后端（后端可能重启导致数据丢失）
        try {
          await fetchJson<ApiResponse>(`${API_BASE_URL}/push/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(existingSubscription),
          });
          statusMessage.value = '检测到当前设备已有订阅，已同步到后端。';
        } catch (syncError) {
          statusMessage.value = '检测到本地订阅，但同步到后端失败，请重新创建订阅。';
          console.error('同步订阅失败:', syncError);
        }
      } else {
        statusMessage.value = '当前设备尚未创建订阅。请先授予通知权限，再创建订阅。';
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '推送初始化失败。';
    }
  });

  return {
    isSupported,
    permissionState,
    isLoading,
    statusMessage,
    canSubscribe,
    hasSubscription,
    isPermissionDenied,
    browserName,
    isStandalone,
    isNonChromeBrowser,
    needsStandalone,
    environmentHint,
    subscribe,
    sendTestNotification,
  };
}
