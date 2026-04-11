<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import PushSubscriptionCard from '../components/push/PushSubscriptionCard.vue';
import { usePushNotifications } from '../composables/usePushNotifications';
import { usePwaDetect } from '../composables/usePwaDetect';

const {
  isSupported,
  permissionState,
  isLoading,
  statusMessage,
  canSubscribe,
  hasSubscription,
  isPermissionDenied,
  subscribe,
  sendTestNotification,
} = usePushNotifications();

const { isPwa } = usePwaDetect();

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const showInstallBanner = ref(false);

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function handleBeforeInstallPrompt(e: Event): void {
  e.preventDefault();
  deferredPrompt.value = e as BeforeInstallPromptEvent;
  if (!isPwa.value) {
    showInstallBanner.value = true;
  }
}

async function installPwa(): Promise<void> {
  if (!deferredPrompt.value) return;
  await deferredPrompt.value.prompt();
  const { outcome } = await deferredPrompt.value.userChoice;
  if (outcome === 'accepted') {
    showInstallBanner.value = false;
  }
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
  <main class="page-shell">
    <section class="hero-panel">
      <p class="eyebrow">消息提醒</p>
      <h1 class="hero-title">管理您的推送通知</h1>
      <p class="hero-copy">
        在此页面管理浏览器推送通知订阅，接收工时填报结果等重要消息提醒。
      </p>
    </section>

    <div v-if="showInstallBanner && !isPwa" class="install-banner">
      <div class="install-banner__content">
        <nut-icon name="tips" size="20" color="#0f3d3e"></nut-icon>
        <div class="install-banner__text">
          <p class="install-banner__title">安装为应用</p>
          <p class="install-banner__desc">安装为 PWA 应用可获得最佳通知体验，支持离线访问</p>
        </div>
      </div>
      <nut-button type="primary" size="small" @click="installPwa">安装</nut-button>
    </div>

    <PushSubscriptionCard
      :is-supported="isSupported"
      :permission-state="permissionState"
      :is-loading="isLoading"
      :status-message="statusMessage"
      :can-subscribe="canSubscribe"
      :has-subscription="hasSubscription"
      :is-permission-denied="isPermissionDenied"
      @subscribe="subscribe"
      @test-notification="sendTestNotification"
    />
  </main>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  display: grid;
  gap: 1.5rem;
  align-content: start;
  padding: 1rem;
  max-width: 720px;
  margin: 0 auto;
}

.hero-panel {
  padding: 1rem 0;
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: #0f3d3e;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  font-size: clamp(1.8rem, 5vw, 2.8rem);
  line-height: 1.1;
}

.hero-copy {
  max-width: 56ch;
  margin: 0.75rem 0 0;
  color: #355254;
  font-size: 0.95rem;
  line-height: 1.7;
}

.install-banner {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.install-banner__content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.install-banner__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.install-banner__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a2e;
}

.install-banner__desc {
  margin: 0;
  font-size: 0.75rem;
  color: #666;
  line-height: 1.4;
}
</style>
