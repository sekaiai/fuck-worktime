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
  border-radius: var(--radius-2xl);
  padding: clamp(1.2rem, 2.4vw, 1.8rem);
}

.notification-page__overview,
.notification-panel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.notification-page__hero {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  align-items: end;
  background:
    radial-gradient(circle at 82% 10%, rgba(112, 170, 255, 0.32), transparent 38%),
    radial-gradient(circle at 8% 92%, rgba(32, 61, 134, 0.55), transparent 42%),
    linear-gradient(135deg, #203d86, #2455d6);
  color: #ffffff;
}

.notification-page__eyebrow,
.notification-panel__eyebrow {
  margin: 0 0 0.5rem;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

/* hero 为深蓝底，info 蓝对比度不足，提亮为浅蓝保证可读性（与登录页一致） */
.notification-page__hero .notification-page__eyebrow {
  color: rgba(168, 203, 255, 0.92);
}

.notification-page__title {
  font-size: clamp(2.2rem, 5vw, 4.2rem);
  line-height: 0.94;
}

.notification-page__copy,
.notification-panel__copy {
  color: var(--color-text-secondary);
  line-height: 1.75;
}

.notification-page__hero .notification-page__copy {
  color: rgba(255, 255, 255, 0.78);
}

.notification-page__overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.notification-page__overview article {
  display: grid;
  gap: 0.3rem;
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.notification-page__overview span {
  color: var(--color-text-tertiary);
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
  background: rgba(239, 154, 24, 0.1);
  border-color: rgba(239, 154, 24, 0.3);
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
  background: rgba(15, 23, 42, 0.06);
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.notification-panel__badge.is-active {
  background: rgba(31, 157, 99, 0.12);
  color: var(--color-success);
}

.notification-panel__warning {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-lg);
  background: rgba(220, 76, 66, 0.08);
  color: var(--color-danger);
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
  background: var(--color-primary);
  color: #ffffff;
}

.notification-panel__primary:hover:not(:disabled) {
  background: var(--color-primary-strong);
  box-shadow: 0 12px 24px rgba(52, 110, 245, 0.24);
}

.notification-panel__secondary {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
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

/* 移动端：隐藏装饰性 eyebrow，标题缩小，overview 改 2 列，收窄间距 */
@media (max-width: 767px) {
  .notification-page {
    padding: 0.75rem;
  }

  .notification-page__eyebrow {
    display: none;
  }

  .notification-page__title {
    font-size: 1.5rem;
  }

  .notification-page__overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .notification-page__hero,
  .notification-panel--warning,
  .notification-page__overview {
    padding: 0.75rem;
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
