<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';

import { usePushSubscriptionCenter } from '../composables/usePushSubscriptionCenter';
import { usePwaDetect } from '../composables/usePwaDetect';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
// 通过 authStore 取 userId，避免登出后停留在该页时仍用旧 localStorage 的 userId 提交订阅。
// Pinia setup store 在实例上访问时会自动解包 ref，因此 authStore.userId 已是 string | null。
const userId = computed(() => authStore.userId);
const notifications = usePushSubscriptionCenter(userId.value);
const { isPwa } = usePwaDetect();

const deferredPrompt = shallowRef<Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
} | null>(null);

const canInstallPwa = computed(() => deferredPrompt.value !== null);
const permissionText = computed(() => {
  if (notifications.permissionState.value === 'granted') {
    return '已允许';
  }
  if (notifications.permissionState.value === 'denied') {
    return '已拒绝';
  }
  return '未选择';
});
const overviewItems = computed(() => [
  {
    label: '浏览器能力',
    value: notifications.isSupported.value ? '支持推送' : '不支持',
  },
  {
    label: '通知权限',
    value: permissionText.value,
  },
  {
    label: '订阅状态',
    value: notifications.hasSubscription.value ? '在线' : '未启用',
  },
]);

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt.value = event as typeof deferredPrompt.value;
}

async function installPwa(): Promise<void> {
  if (!deferredPrompt.value) {
    return;
  }

  await deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  // 安装流程结束后必须清空，否则按钮可重复点击且 prompt() 第二次会直接 reject
  deferredPrompt.value = null;
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
});
</script>

<template>
  <main class="notification-page">
    <section class="notification-page__hero">
      <div>
        <p class="notification-page__eyebrow">Push Operations</p>
        <h1 class="notification-page__title">通知链路控制台</h1>
      </div>
      <p class="notification-page__copy">
        在这里校验浏览器推送能力、通知权限和订阅状态。自动填报执行后，成功、失败和过期提醒都会走这条链路。
      </p>
    </section>

    <section class="notification-page__overview">
      <article v-for="item in overviewItems" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </section>

    <section v-if="!isPwa" class="notification-panel notification-panel--warning">
      <div>
        <p class="notification-panel__eyebrow">PWA Required</p>
        <h2 class="notification-panel__title">建议先安装为应用</h2>
        <p class="notification-panel__copy">
          当前不是 PWA 环境，通知体验可能被浏览器限制。若当前浏览器支持安装，建议先安装后再完成订阅。
        </p>
      </div>
      <button class="notification-panel__primary" type="button" :disabled="!canInstallPwa" @click="installPwa">
        尝试安装 PWA
      </button>
    </section>

    <section class="notification-panel">
      <header class="notification-panel__header">
        <div>
          <p class="notification-panel__eyebrow">Subscription Control</p>
          <h2 class="notification-panel__title">浏览器订阅管理</h2>
        </div>
        <span class="notification-panel__badge" :class="{ 'is-active': notifications.hasSubscription.value }">
          {{ notifications.hasSubscription.value ? '已订阅' : '未订阅' }}
        </span>
      </header>

      <p class="notification-panel__copy">{{ notifications.statusMessage.value }}</p>

      <div
        v-if="notifications.permissionState.value === 'denied'"
        class="notification-panel__warning"
      >
        请在浏览器地址栏的站点权限中将“通知”改为允许，然后刷新页面重试。
      </div>

      <div class="notification-panel__actions">
        <button
          v-if="!notifications.hasSubscription.value"
          class="notification-panel__primary"
          type="button"
          :disabled="notifications.isLoading.value || !notifications.canSubscribe.value"
          @click="notifications.subscribe"
        >
          {{ notifications.isLoading.value ? '处理中...' : '订阅通知' }}
        </button>
        <button
          v-if="notifications.hasSubscription.value"
          class="notification-panel__secondary"
          type="button"
          :disabled="notifications.isLoading.value"
          @click="notifications.unsubscribe"
        >
          取消订阅
        </button>
        <button
          v-if="notifications.hasSubscription.value"
          class="notification-panel__secondary"
          type="button"
          :disabled="notifications.isLoading.value"
          @click="notifications.sendTest"
        >
          发送测试通知
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.notification-page {
  width: min(100%, 1120px);
  margin: 0 auto;
  min-height: 100vh;
  padding: clamp(1rem, 3vw, 2rem);
  display: grid;
  gap: 1rem;
}

.notification-page__hero,
.notification-page__overview,
.notification-panel {
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.84), rgba(240, 234, 226, 0.72));
  padding: clamp(1.2rem, 2.4vw, 1.8rem);
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.1);
  backdrop-filter: blur(16px);
}

.notification-page__hero {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  align-items: end;
}

.notification-page__eyebrow,
.notification-panel__eyebrow {
  margin: 0 0 0.5rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.notification-page__title {
  font-size: clamp(2.2rem, 5vw, 4.2rem);
  line-height: 0.94;
}

.notification-page__copy,
.notification-panel__copy {
  color: var(--ink-soft);
  line-height: 1.75;
}

.notification-page__overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.notification-page__overview article {
  display: grid;
  gap: 0.3rem;
  border-radius: 20px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.notification-page__overview span {
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.notification-page__overview strong {
  font-family: var(--font-display);
  font-size: 1.12rem;
}

.notification-panel--warning {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  background:
    linear-gradient(135deg, rgba(255, 244, 220, 0.92), rgba(247, 235, 209, 0.84));
  border-color: rgba(196, 131, 45, 0.24);
}

.notification-panel__header {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding-right: 7.5rem;
}

.notification-panel__title {
  font-size: clamp(1.55rem, 4vw, 2.1rem);
}

.notification-panel__badge {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.notification-panel__badge.is-active {
  background: rgba(35, 76, 75, 0.14);
  color: var(--accent);
}

.notification-panel__warning {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  background: rgba(170, 71, 55, 0.08);
  color: var(--danger);
}

.notification-panel__actions {
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.notification-panel__primary,
.notification-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1.15rem;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
}

.notification-panel__primary:hover:not(:disabled),
.notification-panel__secondary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.notification-panel__primary:disabled,
.notification-panel__secondary:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.notification-panel__primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.notification-panel__secondary {
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

@media (max-width: 860px) {
  .notification-page__hero,
  .notification-panel--warning,
  .notification-page__overview {
    grid-template-columns: 1fr;
  }

  .notification-panel--warning {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .notification-panel__header {
    padding-right: 6.5rem;
  }

  .notification-page__overview {
    grid-template-columns: 1fr;
  }
}
</style>
