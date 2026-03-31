<script setup lang="ts">
import PushSubscriptionCard from '../components/push/PushSubscriptionCard.vue';
import { usePushNotifications } from '../composables/usePushNotifications';

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
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <p class="eyebrow">PWA + Web Push 起步模板</p>
      <h1 class="hero-title">前端工作区已就绪</h1>
      <p class="hero-copy">
        当前模板已完成 PWA Manifest、Service Worker 注册、通知权限流程以及后端订阅接口接入。
      </p>
    </section>

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
  gap: 2rem;
  align-content: center;
  padding: 2rem;
}

.hero-panel {
  max-width: 720px;
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
  font-size: clamp(2.4rem, 5vw, 4.5rem);
  line-height: 0.95;
}

.hero-copy {
  max-width: 56ch;
  margin: 1rem 0 0;
  color: #355254;
  font-size: 1.05rem;
  line-height: 1.7;
}
</style>
