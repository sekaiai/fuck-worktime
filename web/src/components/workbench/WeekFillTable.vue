<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import WeekFillDay from './WeekFillDay.vue';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { dayForms, isWeekLoading, errorMessage, errorCode } = storeToRefs(homeStore);

const isWeekError = computed(
  () => Boolean(errorMessage.value) && errorCode.value !== 'TOKEN_EXPIRED',
);

function onRetry(): void {
  void homeStore.refreshWeekBoard();
}
</script>

<template>
  <section class="wf-table">
    <div v-if="isWeekLoading" class="wf-table__skeletons" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="wf-table__skeleton">
        <div class="wf-table__skeleton-head">
          <span class="wf-table__skeleton-caret"></span>
          <span class="wf-table__skeleton-title"></span>
          <span class="wf-table__skeleton-hours"></span>
          <span class="wf-table__skeleton-status"></span>
        </div>
        <div class="wf-table__skeleton-body">
          <span class="wf-table__skeleton-line"></span>
          <span class="wf-table__skeleton-line is-short"></span>
        </div>
      </div>
    </div>

    <div v-else-if="isWeekError" class="wf-table__error">
      <p class="wf-table__error-text">{{ errorMessage }}</p>
      <button type="button" class="wf-table__retry" :disabled="isWeekLoading" @click="onRetry">
        重试
      </button>
    </div>

    <template v-else>
      <WeekFillDay
        v-for="item in dayForms"
        :key="item.day.date"
        :day="item.day"
        :status="item.status"
        :form="item.form"
      />
    </template>
  </section>
</template>

<style scoped>
.wf-table {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  overflow: hidden;
}

.wf-table__skeletons {
  display: grid;
}

.wf-table__skeleton {
  display: grid;
  gap: 0.55rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.wf-table__skeleton:last-child {
  border-bottom: 0;
}

.wf-table__skeleton-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.wf-table__skeleton-caret {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
}

.wf-table__skeleton-title {
  width: 5.5rem;
  height: 0.9rem;
  border-radius: 6px;
}

.wf-table__skeleton-hours {
  margin-left: auto;
  width: 2.2rem;
  height: 0.85rem;
  border-radius: 6px;
}

.wf-table__skeleton-status {
  width: 3rem;
  height: 0.75rem;
  border-radius: 6px;
}

.wf-table__skeleton-body {
  display: grid;
  gap: 0.5rem;
  padding-left: 1.35rem;
}

.wf-table__skeleton-line {
  height: 0.72rem;
  border-radius: 6px;
}

.wf-table__skeleton-line.is-short {
  width: 55%;
}

.wf-table__skeleton span {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-bg-soft) 25%,
    color-mix(in srgb, var(--color-bg-soft) 60%, white) 37%,
    var(--color-bg-soft) 63%
  );
  background-size: 200% 100%;
  animation: wf-table-shimmer 1.4s ease-in-out infinite;
}

@keyframes wf-table-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

.wf-table__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1.05rem 1rem;
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-panel));
}

.wf-table__error-text {
  margin: 0;
  flex: 1;
  min-width: 12rem;
  color: var(--color-danger);
  font-size: 0.86rem;
  line-height: 1.6;
}

.wf-table__retry {
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  border-radius: var(--radius-sm);
  padding: 0.45rem 1.2rem;
  background: transparent;
  color: var(--color-danger);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.wf-table__retry:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
