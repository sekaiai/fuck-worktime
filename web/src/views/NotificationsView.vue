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
      <p class="eyebrow">消息提醒</p>
      <h1 class="hero-title">管理您的推送通知</h1>
      <p class="hero-copy">
        在此页面管理浏览器推送通知订阅，接收重要消息提醒。支持订阅管理、权限控制以及测试通知发送。
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
