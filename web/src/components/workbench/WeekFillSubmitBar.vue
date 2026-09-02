<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';

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
function formatData(data: unknown | null): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  try {
    return JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    return String(data);
  }
}

function stepLabel(name: string): string {
  const labels: Record<string, string> = {
    flow: '获取流程',
    buttons: '获取按钮',
    handle: '重新提交',
    reportBatch: '批量提交',
  };
  return labels[name] ?? name;
}
</script>

<template>
  <div class="wf-submit">
    <p class="wf-submit__stat">待提交 {{ pendingCount }} 条 · {{ pendingHours }}h</p>

    <p v-if="firstError" class="wf-submit__error">
      {{ firstError.reportDate.slice(5) }} {{ firstError.message }}
      <template v-if="rowErrors.length > 1">（共 {{ rowErrors.length }} 处）</template>
    </p>

    <div v-if="weekFillSubmitResult" class="wf-submit__result" aria-live="polite">
      <span>上游状态 {{ weekFillSubmitResult.code }}</span>
      <strong>{{ weekFillSubmitResult.msg }}</strong>

      <div v-for="item in weekFillSubmitResult.items" :key="item.rowId" class="wf-submit__item">
        <div class="wf-submit__item-title">
          {{ item.reportDate }} · {{ item.mode === 'flow' ? '重新提交' : '新建批量' }} ·
          {{ item.success ? '成功' : '失败' }}
        </div>
        <strong v-if="item.errorMessage">{{ item.errorMessage }}</strong>
        <div v-for="(step, index) in item.steps" :key="`${item.rowId}-${step.name}-${index}`" class="wf-submit__step">
          <span>{{ stepLabel(step.name) }} · code {{ step.code }}</span>
          <strong>{{ step.msg }}</strong>
          <pre v-if="formatData(step.data)">{{ formatData(step.data) }}</pre>
        </div>
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
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-border);
  border-radius: 18px;
}

.wf-submit__stat {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wf-submit__error {
  margin: 0;
  color: #dc4c42;
  font-size: 0.8rem;
}

.wf-submit__btn {
  margin-left: auto;
  border: 0;
  border-radius: 12px;
  padding: 0.6rem 1.4rem;
  background: var(--color-primary);
  color: #fff;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.wf-submit__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wf-submit__result {
  flex: 1 1 100%;
  display: grid;
  gap: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.wf-submit__result strong {
  color: var(--color-text-primary);
}

.wf-submit__item {
  display: grid;
  gap: 0.25rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.wf-submit__item-title {
  color: var(--color-text-primary);
  font-weight: 600;
}

.wf-submit__step {
  display: grid;
  gap: 0.15rem;
  padding-left: 0.75rem;
}

.wf-submit__result pre {
  max-height: 10rem;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
}
</style>
