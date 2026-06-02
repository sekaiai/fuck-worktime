<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'card' | 'list' | 'text' | 'avatar';
  count?: number;
  height?: string;
  animated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  count: 1,
  height: '1rem',
  animated: true,
});

const items = computed(() => Array.from({ length: props.count }, (_, i) => i));
</script>

<template>
  <div class="skeleton" :class="[`skeleton--${variant}`, { 'skeleton--animated': animated }]">
    <div v-for="item in items" :key="item" class="skeleton__item" :style="{ height: height }"></div>
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton--card {
  display: grid;
  gap: 1rem;
}

.skeleton--list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton__item {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(19, 38, 40, 0.08);
}

.skeleton--animated .skeleton__item::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton--card .skeleton__item {
  min-height: 120px;
  border-radius: 16px;
}

.skeleton--avatar .skeleton__item {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.skeleton--text .skeleton__item {
  border-radius: 8px;
}
</style>
