<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import { formatShortDateKey } from '../../utils/date';

const homeStore = useHomeStore();
const {
  pendingCount,
  pendingHours,
  rowErrors,
  canSubmitWeek,
  isWeekFillSubmitting,
  weekFillSubmitResult,
} = storeToRefs(homeStore);

const firstError = computed(() => rowErrors.value[0] ?? null);

const successCount = computed(
  () => weekFillSubmitResult.value?.items.filter((item) => item.success).length ?? 0,
);

const failCount = computed(() => {
  const result = weekFillSubmitResult.value;
  return result ? result.items.length - successCount.value : 0;
});

const hasFailure = computed(() => failCount.value > 0);

const resultSummary = computed(() => {
  const result = weekFillSubmitResult.value;
  if (!result) {
    return '';
  }

  if (failCount.value === 0) {
    return `提交完成：${result.items.length} 条已提交`;
  }
  if (successCount.value === 0) {
    return `提交失败：${result.items.length} 条未成功`;
  }
  return `提交完成：成功 ${successCount.value} 条，失败 ${failCount.value} 条`;
});
</script>

<template>
  <div class="wf-submit">
    <p class="wf-submit__stat">待提交 {{ pendingCount }} 条 · {{ pendingHours }}h</p>

    <p v-if="firstError" class="wf-submit__error">
      {{ formatShortDateKey(firstError.reportDate) }} {{ firstError.message }}
      <template v-if="rowErrors.length > 1">（共 {{ rowErrors.length }} 处）</template>
    </p>

    <div v-if="weekFillSubmitResult" class="wf-submit__result" aria-live="polite">
      <div class="wf-submit__result-head">
        <span class="wf-submit__summary" :class="hasFailure ? 'is-error' : 'is-success'">
          {{ resultSummary }}
        </span>
        <button
          type="button"
          class="wf-submit__close"
          aria-label="关闭结果"
          @click="homeStore.clearWeekFillSubmitResult()"
        >
          ✕
        </button>
      </div>

      <div v-for="item in weekFillSubmitResult.items" :key="item.rowId" class="wf-submit__item">
        <div class="wf-submit__item-title">
          {{ formatShortDateKey(item.reportDate) }} · {{ item.mode === 'flow' ? '重提' : '新建' }} ·
          {{ item.success ? '成功' : '失败' }}
        </div>
        <p v-if="item.errorMessage" class="wf-submit__item-error">{{ item.errorMessage }}</p>
      </div>
    </div>

    <button
      type="button"
      class="wf-submit__btn"
      :disabled="!canSubmitWeek"
      @click="homeStore.submitWeekFill()"
    >
      {{ isWeekFillSubmitting ? '提交中…' : '批量提交' }}
    </button>
  </div>
</template>

<style scoped>
.wf-submit {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1.1rem;
  background: var(--color-bg-panel-blur);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}

.wf-submit__stat {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wf-submit__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.8rem;
}

.wf-submit__btn {
  margin-left: auto;
  border: 0;
  border-radius: var(--radius-md);
  padding: 0.6rem 1.4rem;
  background: var(--color-primary);
  color: #fff;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.wf-submit__btn:hover:not(:disabled) {
  background: var(--color-primary-strong);
}

.wf-submit__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wf-submit__result {
  flex: 1 1 100%;
  display: grid;
  gap: 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.wf-submit__result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wf-submit__summary {
  font-weight: 600;
}

.wf-submit__summary.is-success {
  color: var(--color-success);
}

.wf-submit__summary.is-error {
  color: var(--color-danger);
}

.wf-submit__close {
  border: 0;
  padding: 0.15rem 0.45rem;
  background: transparent;
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  line-height: 1.2;
  cursor: pointer;
}

.wf-submit__close:hover {
  color: var(--color-text-primary);
}

.wf-submit__item {
  display: grid;
  gap: 0.25rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.wf-submit__item-title {
  color: var(--color-text-primary);
  font-weight: 600;
}

.wf-submit__item-error {
  margin: 0;
  color: var(--color-danger);
}
</style>
