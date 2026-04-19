<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { usePwaDetect } from '../../composables/usePwaDetect';
import { useHomeStore } from '../../stores/home';

const { isPwa } = usePwaDetect();
const router = useRouter();
const { notifyVisible } = storeToRefs(useHomeStore());
const environmentText = computed(() => (isPwa.value ? '已安装为应用' : '当前仍在浏览器环境'));

function openNotifications(): void {
  void router.push('/notifications');
}
</script>

<template>
  <section v-if="notifyVisible" class="notification-card">
    <div class="notification-card__header">
      <div>
        <p class="notification-card__eyebrow">Notification Relay</p>
        <h2 class="notification-card__title">自动填报提醒已接入</h2>
      </div>
      <span class="notification-card__badge">{{ environmentText }}</span>
    </div>

    <p class="notification-card__copy">
      自动填报启用后，可在通知页订阅成功、失败和过期提醒。建议安装为 PWA，以获得更稳定的前台与后台通知体验。
    </p>

    <button class="notification-card__button" type="button" @click="openNotifications">前往通知页</button>
  </section>
</template>

<style scoped>
.notification-card {
  display: grid;
  gap: 1rem;
  border-radius: 28px;
  padding: 1.25rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.82), rgba(239, 233, 225, 0.72));
  box-shadow: 0 22px 44px rgba(20, 41, 44, 0.09);
}

.notification-card__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.notification-card__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.notification-card__title {
  font-size: 1.55rem;
}

.notification-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}

.notification-card__copy {
  color: var(--ink-soft);
  line-height: 1.7;
}

.notification-card__button {
  justify-self: start;
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1.05rem;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
  cursor: pointer;
}

@media (max-width: 640px) {
  .notification-card__header {
    flex-direction: column;
  }
}
</style>
