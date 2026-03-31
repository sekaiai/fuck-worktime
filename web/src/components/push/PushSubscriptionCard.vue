<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isSupported: boolean;
  permissionState: NotificationPermission;
  isLoading: boolean;
  statusMessage: string;
  canSubscribe: boolean;
  hasSubscription: boolean;
  isPermissionDenied: boolean;
}>();

const emit = defineEmits<{
  subscribe: [];
  testNotification: [];
}>();

const permissionText = computed(() => {
  if (props.permissionState === 'granted') {
    return '已允许';
  }
  if (props.permissionState === 'denied') {
    return '已拒绝';
  }
  return '未选择';
});
</script>

<template>
  <section class="card">
    <header class="card-header">
      <div>
        <p class="card-kicker">推送控制台</p>
        <h2 class="card-title">浏览器通知订阅</h2>
      </div>
      <span class="pill" :class="{ 'pill-live': hasSubscription }">
        {{ hasSubscription ? '已订阅' : '未订阅' }}
      </span>
    </header>

    <dl class="status-grid">
      <div class="status-item">
        <dt class="status-label">浏览器支持</dt>
        <dd class="status-value">{{ isSupported ? '支持' : '不支持' }}</dd>
      </div>
      <div class="status-item">
        <dt class="status-label">通知权限</dt>
        <dd class="status-value">{{ permissionText }}</dd>
      </div>
    </dl>

    <p class="status-copy">{{ props.statusMessage }}</p>

    <div v-if="isPermissionDenied" class="permission-warning">
      <p class="warning-title">⚠️ 通知权限被拒绝</p>
      <p class="warning-text">
        请在浏览器地址栏左侧点击锁图标（或信息图标），将"通知"权限改为"允许"，然后刷新页面重试。
      </p>
    </div>

    <div class="actions">
      <button
        class="button button-primary"
        type="button"
        :disabled="!canSubscribe || isLoading"
        @click="emit('subscribe')"
      >
        {{ isLoading ? '处理中...' : '创建订阅' }}
      </button>
      <button
        class="button button-secondary"
        type="button"
        :disabled="!hasSubscription || isLoading"
        @click="emit('testNotification')"
      >
        发送测试推送
      </button>
    </div>
  </section>
</template>

<style scoped>
.card {
  max-width: 720px;
  padding: 1.5rem;
  border: 1px solid rgba(15, 61, 62, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgba(15, 61, 62, 0.12);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.card-kicker {
  margin: 0 0 0.35rem;
  color: #7d5c2f;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.card-title {
  margin: 0;
  font-size: 1.6rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  background: #e5e4df;
  color: #445b5d;
  font-size: 0.85rem;
  font-weight: 700;
}

.pill-live {
  background: #0f3d3e;
  color: #f7f3ea;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0 1rem;
}

.status-item {
  margin: 0;
  padding: 1rem;
  border-radius: 20px;
  background: #f7f3ea;
}

.status-label {
  color: #6b7879;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-value {
  margin: 0.4rem 0 0;
  color: #0d2324;
  font-size: 1.05rem;
  font-weight: 700;
}

.status-copy {
  margin: 0 0 1.25rem;
  color: #355254;
  line-height: 1.7;
}

.permission-warning {
  margin: 0 0 1.25rem;
  padding: 1rem;
  border-radius: 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
}

.warning-title {
  margin: 0 0 0.5rem;
  color: #856404;
  font-weight: 700;
}

.warning-text {
  margin: 0;
  color: #856404;
  font-size: 0.9rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.4rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 180ms ease, opacity 180ms ease;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.button-primary {
  background: #0f3d3e;
  color: #f7f3ea;
}

.button-secondary {
  background: #e6ddd0;
  color: #1f3536;
}

@media (max-width: 640px) {
  .status-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
  }
}
</style>
