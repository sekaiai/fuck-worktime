<script setup lang="ts">
import { useRouter } from 'vue-router';

import { usePwaDetect } from '../../composables/usePwaDetect';

defineProps<{
  visible: boolean;
}>();

const { isPwa } = usePwaDetect();
const router = useRouter();

function openNotifications(): void {
  void router.push('/notifications');
}
</script>

<template>
  <section v-if="visible" class="panel">
    <div class="card-row">
      <div>
        <p class="card-eyebrow">消息订阅</p>
        <h2 class="card-title">消息订阅通知</h2>
        <p class="card-copy">自动填报开启后，可在通知页订阅成功/失败提醒。</p>
      </div>
      <button class="card-button" type="button" @click="openNotifications">前往通知页</button>
    </div>
    <p v-if="!isPwa" class="card-tip">当前不是 PWA 环境，建议先安装为应用后再订阅通知。</p>
  </section>
</template>

<style scoped>
.panel {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  padding: 1.1rem;
  box-shadow: 0 16px 36px rgba(15, 61, 62, 0.08);
}

.card-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.card-eyebrow {
  margin: 0;
  color: #7c6c54;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.76rem;
}

.card-title {
  margin: 0.25rem 0;
}

.card-copy,
.card-tip {
  margin: 0;
  color: #5f645b;
}

.card-tip {
  margin-top: 0.75rem;
  color: #946200;
}

.card-button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1rem;
  background: #0f4f53;
  color: #fff;
  cursor: pointer;
}

@media (max-width: 680px) {
  .card-row {
    flex-direction: column;
  }
}
</style>
