import { computed, onMounted, shallowRef } from 'vue';

import { getPushPublicKey, sendPushTest, subscribePush, unsubscribePush } from '../api/push';

function base64ToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function usePushSubscriptionCenter(userId: string | null) {
  const isLoading = shallowRef(false);
  const statusMessage = shallowRef('准备就绪，请先授予通知权限。');
  const permissionState = shallowRef<NotificationPermission>(
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  );
  const currentSubscription = shallowRef<PushSubscription | null>(null);

  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  );

  const hasSubscription = computed(() => currentSubscription.value !== null);
  const canSubscribe = computed(
    () => isSupported.value && permissionState.value !== 'denied' && !hasSubscription.value,
  );

  async function getRegistration() {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }

    return navigator.serviceWorker.ready;
  }

  async function subscribe() {
    if (!userId) {
      statusMessage.value = '请先登录后再订阅通知。';
      return;
    }

    if (!isSupported.value) {
      statusMessage.value = '当前环境不支持浏览器推送通知。';
      return;
    }

    isLoading.value = true;
    try {
      permissionState.value = await Notification.requestPermission();
      if (permissionState.value !== 'granted') {
        statusMessage.value = '未获得通知权限，无法创建订阅。';
        return;
      }

      const publicKey = await getPushPublicKey();
      const registration = await getRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });

      currentSubscription.value = subscription;
      await subscribePush({
        userId,
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: subscription.toJSON().keys?.p256dh ?? '',
          auth: subscription.toJSON().keys?.auth ?? '',
        },
      });
      statusMessage.value = '订阅成功，后续可接收自动填报通知。';
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '订阅通知失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function unsubscribe() {
    if (!currentSubscription.value) {
      statusMessage.value = '当前没有可取消的订阅。';
      return;
    }

    isLoading.value = true;
    try {
      await unsubscribePush(currentSubscription.value.endpoint);
      await currentSubscription.value.unsubscribe();
      currentSubscription.value = null;
      statusMessage.value = '已取消通知订阅。';
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '取消订阅失败。';
    } finally {
      isLoading.value = false;
    }
  }

  async function sendTest() {
    if (!hasSubscription.value) {
      statusMessage.value = '请先完成订阅，再发送测试通知。';
      return;
    }

    isLoading.value = true;
    try {
      const result = await sendPushTest();
      statusMessage.value = result.message;
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '发送测试通知失败。';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(async () => {
    if (!isSupported.value) {
      statusMessage.value = '当前环境不支持浏览器推送通知。';
      return;
    }

    try {
      const registration = await getRegistration();
      currentSubscription.value = await registration.pushManager.getSubscription();
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '初始化通知订阅失败。';
    }
  });

  return {
    isSupported,
    permissionState,
    isLoading,
    statusMessage,
    hasSubscription,
    canSubscribe,
    subscribe,
    unsubscribe,
    sendTest,
  };
}
