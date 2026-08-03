<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { pendingCount, pendingHours, rowErrors, canSubmitWeek, isWeekFillSubmitting } =
  storeToRefs(homeStore);

const firstError = computed(() => rowErrors.value[0] ?? null);
</script>

<template>
  <div class="wf-submit">
    <p class="wf-submit__stat">待提交 {{ pendingCount }} 条 · {{ pendingHours }}h</p>

    <p v-if="firstError" class="wf-submit__error">
      {{ firstError.reportDate.slice(5) }} {{ firstError.message }}
      <template v-if="rowErrors.length > 1">（共 {{ rowErrors.length }} 处）</template>
    </p>

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
</style>
