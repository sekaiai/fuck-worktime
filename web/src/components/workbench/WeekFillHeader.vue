<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { weekRange, isCurrentWeek, isWeekLoading, totalHours, dayForms } = storeToRefs(homeStore);

const summary = computed(() => {
  const pending = dayForms.value.filter((item) => item.status.key === 'none').length;
  const rejected = dayForms.value.filter((item) => item.status.key === 'rejected').length;
  return { pending, rejected };
});
</script>

<template>
  <header class="wf-header">
    <div class="wf-header__nav">
      <button
        type="button"
        :disabled="isWeekLoading"
        @click="homeStore.switchWeekAndReset('previous')"
      >‹ 上一周</button>
      <button
        type="button"
        class="is-current"
        :disabled="isWeekLoading || isCurrentWeek"
        @click="homeStore.switchWeekAndReset('current')"
      >本周</button>
    </div>

    <div class="wf-header__info">
      <p class="wf-header__range">{{ weekRange || '加载中…' }}</p>
      <p class="wf-header__summary">
        已录入 {{ totalHours }}h / 40h
        <template v-if="summary.pending > 0"> · 待填 {{ summary.pending }} 天</template>
        <template v-if="summary.rejected > 0"> · {{ summary.rejected }} 天审核失败</template>
      </p>
    </div>
  </header>
</template>

<style scoped>
.wf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.85rem 1.1rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 18px;
}

.wf-header__nav {
  display: flex;
  gap: 0.4rem;
}

.wf-header__nav button {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.45rem 0.85rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.wf-header__nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wf-header__nav button.is-current {
  border-color: var(--color-border-strong);
  background: color-mix(in srgb, var(--color-primary) 10%, white);
  color: var(--color-primary);
  font-weight: 600;
}

.wf-header__info {
  text-align: right;
}

.wf-header__range {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wf-header__summary {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
