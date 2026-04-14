<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue';

import { usePushSubscriptionCenter } from '../composables/usePushSubscriptionCenter';
import { usePwaDetect } from '../composables/usePwaDetect';
import { getLocalStorage } from '../utils/cache';

const userId = getLocalStorage('userId');
const notifications = usePushSubscriptionCenter(userId);
const { isPwa } = usePwaDetect();

const deferredPrompt = shallowRef<Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
} | null>(null);

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
    <section class="notification-hero">
      <p class="notification-eyebrow">Notifications</p>
      <h1 class="notification-title">通知订阅管理</h1>
      <p class="notification-copy">用户可以在这里订阅通知、取消订阅，并测试推送链路是否可用。</p>
    </section>

    <section v-if="!isPwa" class="notification-card notification-card--warning">
      <h2>先安装为 PWA 应用</h2>
      <p>当前不是 PWA 环境，通知体验可能受限。若浏览器支持安装，可先安装后再继续订阅。</p>
      <button class="primary-button" type="button" @click="installPwa">尝试安装 PWA</button>
    </section>

    <section class="notification-card">
      <div class="notification-grid">
        <div>
          <span>浏览器支持</span>
          <strong>{{ notifications.isSupported.value ? '支持' : '不支持' }}</strong>
        </div>
        <div>
          <span>通知权限</span>
          <strong>{{ notifications.permissionState.value }}</strong>
        </div>
        <div>
          <span>订阅状态</span>
          <strong>{{ notifications.hasSubscription.value ? '已订阅' : '未订阅' }}</strong>
        </div>
      </div>

      <p class="notification-status">{{ notifications.statusMessage.value }}</p>

      <div class="notification-actions">
        <button class="primary-button" type="button" :disabled="notifications.isLoading.value || !notifications.canSubscribe.value" @click="notifications.subscribe">
          {{ notifications.isLoading.value ? '处理中...' : '订阅通知' }}
        </button>
        <button class="secondary-button" type="button" :disabled="notifications.isLoading.value || !notifications.hasSubscription.value" @click="notifications.unsubscribe">
          取消订阅
        </button>
        <button class="secondary-button" type="button" :disabled="notifications.isLoading.value || !notifications.hasSubscription.value" @click="notifications.sendTest">
          发送测试通知
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.notification-page {
  min-height: 100vh;
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}

.notification-hero,
.notification-card {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  padding: 1.2rem;
  box-shadow: 0 16px 36px rgba(15, 61, 62, 0.08);
}

.notification-card--warning {
  background: #fff7e5;
}

.notification-eyebrow {
  margin: 0;
  color: #7c6c54;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.76rem;
}

.notification-title {
  margin: 0.35rem 0 0;
}

.notification-copy,
.notification-status {
  margin: 0.7rem 0 0;
  color: #5f645b;
}

.notification-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.notification-grid div {
  border-radius: 18px;
  background: #f6f3ec;
  padding: 0.9rem;
  display: grid;
  gap: 0.25rem;
}

.notification-grid span {
  color: #5f645b;
}

.notification-actions {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.primary-button,
.secondary-button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1rem;
  cursor: pointer;
}

.primary-button {
  background: #0f4f53;
  color: #fff;
}

.secondary-button {
  background: #ece8df;
  color: #24383f;
}

@media (max-width: 680px) {
  .notification-grid {
    grid-template-columns: 1fr;
  }
}
</style>
