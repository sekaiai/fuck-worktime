<script setup lang="ts">
import { computed } from 'vue';

type ErrorType = 'network' | 'auth' | 'validation' | 'business' | 'unknown';

interface Props {
  type?: ErrorType;
  title?: string;
  message: string;
  showRetry?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'unknown',
  showRetry: true,
});

const emit = defineEmits<{
  retry: [];
}>();

const errorConfig = computed(() => {
  switch (props.type) {
    case 'network':
      return {
        icon: '🌐',
        title: '网络连接失败',
        description: '请检查您的网络连接后重试',
        color: 'var(--ink-soft)',
      };
    case 'auth':
      return {
        icon: '🔐',
        title: '认证失败',
        description: '您的登录状态已失效，请重新登录',
        color: 'var(--accent-amber)',
      };
    case 'validation':
      return {
        icon: '⚠️',
        title: '数据验证失败',
        description: '请检查输入的数据是否正确',
        color: 'var(--accent)',
      };
    case 'business':
      return {
        icon: '📋',
        title: '业务处理失败',
        description: props.message,
        color: 'var(--accent)',
      };
    default:
      return {
        icon: '❌',
        title: '发生错误',
        description: props.message,
        color: 'var(--danger)',
      };
  }
});

const displayTitle = computed(() => props.title || errorConfig.value.title);
</script>

<template>
  <div class="error-message" :style="{ '--error-color': errorConfig.color }">
    <div class="error-message__icon">{{ errorConfig.icon }}</div>
    <div class="error-message__content">
      <h3 class="error-message__title">{{ displayTitle }}</h3>
      <p class="error-message__description">{{ errorConfig.description }}</p>
    </div>
    <button v-if="showRetry" class="error-message__retry" type="button" @click="emit('retry')">
      🔄 重试
    </button>
  </div>
</template>

<style scoped>
.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  border-radius: 22px;
  background: rgba(170, 71, 55, 0.08);
  border: 1px solid rgba(170, 71, 55, 0.12);
  text-align: center;
}

.error-message__icon {
  font-size: 3rem;
  line-height: 1;
}

.error-message__content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error-message__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--error-color);
}

.error-message__description {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
}

.error-message__retry {
  border: 0;
  border-radius: 999px;
  min-height: 2.8rem;
  padding: 0.65rem 1.2rem;
  background: var(--error-color);
  color: white;
  font-family: var(--font-display);
  font-size: 0.88rem;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.error-message__retry:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(17, 43, 46, 0.16);
}
</style>
