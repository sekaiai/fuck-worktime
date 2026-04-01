<script setup lang="ts">
import UniPushCard from '../components/push/UniPushCard.vue';
import { useUniPush } from '../composables/useUniPush';

const {
  isConfigured,
  isLoading,
  statusMessage,
  cid,
  registrationCount,
  sdkReady,
  sdkError,
  registerDevice,
  unregisterDevice,
  sendMessage,
  autoRegister,
} = useUniPush();
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <p class="eyebrow">Uni-Push 推送服务</p>
      <h1 class="hero-title">云上工时</h1>
      <p class="hero-copy">
        当前模板已集成 Uni-Push 推送服务，支持 Android、iOS、Web 等多平台推送。
      </p>
    </section>

    <UniPushCard
      :is-configured="isConfigured"
      :is-loading="isLoading"
      :status-message="statusMessage"
      :cid="cid"
      :registration-count="registrationCount"
      :sdk-ready="sdkReady"
      :sdk-error="sdkError"
      @register="registerDevice"
      @unregister="unregisterDevice"
      @send-message="sendMessage"
      @auto-register="autoRegister"
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
  color: #7d5c2f;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  font-size: 1.6rem;
}

.hero-copy {
  margin: 0.5rem 0 0;
  color: #355254;
  line-height: 1.7;
}
</style>
