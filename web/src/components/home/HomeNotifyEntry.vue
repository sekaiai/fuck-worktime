<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePwaDetect } from '../../composables/usePwaDetect';

defineProps<{
  autoFillEnabled: boolean;
}>();

const router = useRouter();
const { isPwa } = usePwaDetect();

function goToNotifications() {
  router.push('/notifications');
}
</script>

<template>
  <section v-if="autoFillEnabled" class="notify-entry">
    <div class="notify-entry__content" @click="goToNotifications">
      <div class="notify-entry__left">
        <nut-icon name="notice" size="20" color="#0f3d3e"></nut-icon>
        <span class="notify-entry__text">消息订阅通知</span>
      </div>
      <nut-icon name="right" size="14" color="#999"></nut-icon>
    </div>
    <div v-if="!isPwa" class="notify-entry__pwa-hint">
      <nut-icon name="tips" size="14" color="#d48806"></nut-icon>
      <span>安装为 PWA 应用可获得最佳通知体验</span>
    </div>
  </section>
</template>

<style scoped>
.notify-entry {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.notify-entry__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.notify-entry__left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notify-entry__text {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.notify-entry__pwa-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #f0f0f0;
  font-size: 0.75rem;
  color: #d48806;
}
</style>
