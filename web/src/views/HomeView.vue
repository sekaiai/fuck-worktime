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
  browserName,
  isStandalone,
  isNonChromeBrowser,
  needsStandalone,
  environmentHint,
  subscribe,
  sendTestNotification,
} = usePushNotifications();
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <p class="eyebrow">PWA + Service Worker + Web Push</p>
      <h1 class="hero-title">非 Chrome 浏览器通知链路检查面板</h1>
      <p class="hero-copy">
        当前页面只围绕一条能力展开：在非 Chrome 浏览器中验证 PWA、通知权限、订阅同步和测试推送是否可以闭环。
      </p>
      <ul class="hero-list">
        <li>优先验证 Safari、Firefox 等非 Chrome 浏览器。</li>
        <li>如果浏览器要求以 PWA 形式运行，页面会直接提示下一步操作。</li>
        <li>测试推送只用于验证当前链路是否可用，不扩展到多平台方案。</li>
      </ul>
    </section>

    <PushSubscriptionCard
      :is-supported="isSupported"
      :permission-state="permissionState"
      :is-loading="isLoading"
      :status-message="statusMessage"
      :can-subscribe="canSubscribe"
      :has-subscription="hasSubscription"
      :is-permission-denied="isPermissionDenied"
      :browser-name="browserName"
      :is-standalone="isStandalone"
      :is-non-chrome-browser="isNonChromeBrowser"
      :needs-standalone="needsStandalone"
      :environment-hint="environmentHint"
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

.hero-list {
  margin: 1.25rem 0 0;
  padding-left: 1.2rem;
  color: #355254;
  line-height: 1.8;
}
</style>
