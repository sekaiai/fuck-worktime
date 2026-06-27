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

    // 防双击：用户在 isLoading 期间再次点击直接忽略
    if (isLoading.value) {
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

      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;
      if (!p256dh || !auth) {
        // 缺少密钥材料时不要以空字符串上报，否则后端会保存无效订阅
        await subscription.unsubscribe().catch(() => {});
        statusMessage.value = '订阅缺少必要的密钥材料，请重试。';
        return;
      }

      currentSubscription.value = subscription;
      await subscribePush({
        userId,
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: { p256dh, auth },
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

    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    try {
      // 先浏览器端取消，再通知后端删除；二者都做最佳努力。
      // 之前是先后端再浏览器，若浏览器端失败，后端已删但浏览器仍持订阅，下次还能拿到。
      const subscription = currentSubscription.value;
      let browserUnsubscribed = false;
      try {
        browserUnsubscribed = await subscription.unsubscribe();
      } catch {
        browserUnsubscribed = false;
      }

      await unsubscribePush(subscription.endpoint);
      currentSubscription.value = null;
      statusMessage.value = browserUnsubscribed
        ? '已取消通知订阅。'
        : '订阅已在服务端取消，浏览器端可能仍保留状态。';
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
