<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';

import AutoFillSettingsDialog from './AutoFillSettingsDialog.vue';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { board, weekTitle, weekRange, isCurrentWeek, isWeekLoading, totalHours, workDays, averageHours, dayForms, autoFillStatus } =
  storeToRefs(homeStore);

const isAutoFillDialogOpen = ref(false);

const summary = computed(() => {
  const pending = dayForms.value.filter((item) => item.status.key === 'none').length;
  const rejected = dayForms.value.filter((item) => item.status.key === 'rejected').length;
  const approvalPending = dayForms.value.filter((item) => item.status.key === 'pending').length;
  return { pending, rejected, approvalPending };
});

const autoFillBadge = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return { className: 'is-enabled', label: '已开启' };
  }

  if (autoFillStatus.value === 'expired') {
    return { className: 'is-expired', label: '已过期' };
  }

  return { className: 'is-disabled', label: '未开启' };
});

async function onOpenAutoFill(): Promise<void> {
  const ok = await homeStore.openAutoFillSettings();
  if (ok) {
    isAutoFillDialogOpen.value = true;
  }
}
</script>

<template>
  <header class="wf-header">
    <div>
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
      <button
        type="button"
        :disabled="isWeekLoading"
        @click="homeStore.switchWeekAndReset('next')"
      >下一周 ›</button>
    </div>
      <p class="wf-header__range">{{ weekRange || '加载中…' }}</p>

    </div>

    <div class="wf-header__info">
      <div class="wf-header__entries">
        <button type="button" class="wf-header__autofill" @click="onOpenAutoFill">
          自动填报
          <span class="wf-header__autofill-badge" :class="autoFillBadge.className">
            <span class="wf-header__autofill-dot" aria-hidden="true"></span>
            {{ autoFillBadge.label }}
          </span>
        </button>
        <RouterLink to="/notifications" class="wf-header__notify">🔔 通知</RouterLink>
      </div>
      <p v-if="board?.userName || board?.deptName" class="wf-header__meta">
        <template v-if="board?.userName">{{ board.userName }}</template>
        <template v-if="board?.userName && board?.deptName"> · </template>
        <template v-if="board?.deptName">{{ board.deptName }}</template>
      </p>
      <p class="wf-header__summary">
        已录入 {{ totalHours }}h · 工作日 {{ workDays }} 天 · 日均 {{ averageHours }}h
        <template v-if="summary.pending > 0"> · 待填 {{ summary.pending }} 天</template>
        <template v-if="summary.approvalPending > 0"> · 待审批 {{ summary.approvalPending }} 天</template>
        <template v-if="summary.rejected > 0"> · {{ summary.rejected }} 天审核失败</template>
      </p>
    </div>
  </header>

  <AutoFillSettingsDialog :open="isAutoFillDialogOpen" @close="isAutoFillDialogOpen = false" />
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

.wf-header__autofill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.32rem 0.8rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.wf-header__autofill:hover {
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.wf-header__entries {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin: 0 0 0.35rem;
}

.wf-header__notify {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.32rem 0.8rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.8rem;
  text-decoration: none;
}

.wf-header__notify:hover {
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.wf-header__autofill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
}

.wf-header__autofill-badge.is-enabled {
  color: var(--color-success);
}

.wf-header__autofill-badge.is-expired {
  color: var(--color-warning);
}

.wf-header__autofill-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--color-text-tertiary);
}

.wf-header__autofill-badge.is-enabled .wf-header__autofill-dot {
  background: var(--color-success);
}

.wf-header__autofill-badge.is-expired .wf-header__autofill-dot {
  background: var(--color-warning);
}

.wf-header__range {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wf-header__title {
  margin: 0 0 0.2rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.wf-header__meta {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.wf-header__summary {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
