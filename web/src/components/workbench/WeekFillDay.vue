<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import WeekFillRow from './WeekFillRow.vue';
import { useHomeStore } from '../../stores/home';
import type { WeekDay, WorkDetail } from '../../types/timesheet';
import type { WeekFillDraftRow } from '../../types/week-fill';
import { isReadonlyTimesheetStatus, type DayStatusResult } from '../../utils/timesheet-status';

const props = defineProps<{
  day: WeekDay;
  status: DayStatusResult;
  form: 'editable' | 'readonly' | 'future' | 'rest';
}>();

const homeStore = useHomeStore();
const { rowsByDate, rowErrors, expandedDates, weekFillRevokingDetailIds } = storeToRefs(homeStore);

const allRows = computed(() => rowsByDate.value[props.day.date] ?? []);
const rows = computed(() =>
  allRows.value.filter((row) => {
    if (!row.sourceId) {
      return true;
    }

    const detail = props.day.details.find((item) => item.id === row.sourceId);
    return !detail || !isReadonlyDetail(detail);
  }),
);
const isExpanded = computed(() => expandedDates.value.includes(props.day.date));
const displayedDetailRows = computed(() =>
  props.day.details
    .map((detail, index) => ({ detail, index }))
    .filter(
      ({ detail }) =>
        isReadonlyDetail(detail) || !rows.value.some((row) => row.sourceId === detail.id),
    )
    .map(({ detail, index }) => ({
      detail,
      row: toDetailRow(detail, index),
      readOnly: !rows.value.some((row) => row.sourceId === detail.id),
    })),
);
const isCompactDay = computed(
  () =>
    (props.form === 'rest' || props.form === 'future') &&
    props.day.details.length === 0 &&
    rows.value.length === 0,
);

const errorOf = computed(() => (rowId: string): string => {
  return rowErrors.value.find((error) => error.rowId === rowId)?.message ?? '';
});

/** 审核失败时展示驳回原因，取第一条非空 statusDesc */
const rejectReason = computed(
  () => props.day.details.find((detail) => detail.statusDesc)?.statusDesc ?? '',
);

const newDraftHours = computed(() =>
  rows.value
    .filter((row) => !row.sourceId)
    .reduce((sum, row) => sum + (Number.isFinite(row.hours) ? row.hours : 0), 0),
);

const dayHours = computed(() => props.day.totalHours + newDraftHours.value);

const remainingHours = computed(() => homeStore.getWeekFillRemainingHours(props.day.date));
const canAddRow = computed(
  () => props.form !== 'future' && props.form !== 'rest' && remainingHours.value > 0,
);

function isRevoking(detailId: string): boolean {
  return weekFillRevokingDetailIds.value.includes(detailId);
}

function isReadonlyDetail(detail: WorkDetail): boolean {
  return isReadonlyTimesheetStatus(detail.status, detail.statusDesc, props.status.key);
}

function toDetailRow(detail: WorkDetail, index: number): WeekFillDraftRow {
  return {
    rowId: `detail_${props.day.date}_${detail.id || index}`,
    reportDate: props.day.date,
    sourceId: detail.id || null,
    projectId: detail.projectId ?? '',
    projectTitle: detail.projectTitle ?? '',
    projectStatus: detail.projectStatus ?? 30,
    itemId: detail.itemId ?? '',
    itemName: detail.itemName ?? '',
    hours: detail.hours,
    content: detail.content,
    period: detail.period,
    status: detail.status,
    statusDesc: detail.statusDesc,
  };
}

function canRevoke(detail: WorkDetail): boolean {
  const detailStatus = `${detail.status} ${detail.statusDesc}`;
  return props.status.key === 'pending' && Boolean(detail.id) && /待审核|待审批/.test(detailStatus);
}

function onRevoke(detail: WorkDetail): void {
  const confirmed = typeof window === 'undefined' ||
    window.confirm(`确认撤回 ${props.day.date} 的 ${detail.hours} 小时填报吗？`);
  if (!confirmed) {
    return;
  }

  void homeStore.revokeWeekFillDetail(detail.id);
}
</script>

<template>
  <!-- 没有任何明细的周末/未来日仍保持紧凑展示 -->
  <div v-if="isCompactDay" class="wf-day wf-day--muted">
    <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
    <span class="wf-day__tag">{{ day.displayStatus || day.displayText || day.status || (form === 'rest' ? '休息日' : '未到') }}</span>
  </div>

  <!-- 有明细的日期统一展示原始明细；只读与可编辑由明细状态决定 -->
  <div v-else class="wf-day">
    <button type="button" class="wf-day__head" @click="homeStore.toggleWeekFillDate(day.date)">
      <span class="wf-day__caret">{{ isExpanded ? '▾' : '▸' }}</span>
      <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
      <span class="wf-day__hours">{{ dayHours }}h</span>
      <span class="wf-day__status" :style="{ color: status.color }">
        {{ day.displayStatus || day.displayText || day.status || status.label }}
      </span>
    </button>

    <div v-if="isExpanded" class="wf-day__body">
      <p v-if="status.key === 'rejected' && rejectReason" class="wf-day__reject">
        驳回原因：{{ rejectReason }}
      </p>

      <div
        v-for="detailRow in displayedDetailRows"
        :key="detailRow.row.rowId"
        class="wf-day__detail-row"
      >
        <WeekFillRow
          :row="detailRow.row"
          :error-message="''"
          :read-only="detailRow.readOnly"
        />
        <button
          v-if="canRevoke(detailRow.detail)"
          type="button"
          class="wf-day__revoke"
          :disabled="weekFillRevokingDetailIds.length > 0"
          @click.stop="onRevoke(detailRow.detail)"
        >
          {{ isRevoking(detailRow.detail.id) ? '撤回中…' : '撤回' }}
        </button>
      </div>

      <WeekFillRow
        v-for="row in rows"
        :key="row.rowId"
        :row="row"
        :error-message="errorOf(row.rowId)"
      />

      <p v-if="day.details.length === 0 && rows.length === 0" class="wf-day__detail">
        无填报内容
      </p>

      <button
        v-if="canAddRow && form !== 'future' && form !== 'rest'"
        type="button"
        class="wf-day__add"
        @click="homeStore.addWeekFillRow(day.date)"
      >
        + 添加一条（剩余 {{ remainingHours }}h）
      </button>
    </div>
  </div>
</template>

<style scoped>
.wf-day {
  display: grid;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.wf-day--muted {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-secondary);
  opacity: 0.65;
  font-size: 0.85rem;
}

.wf-day__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.2rem 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.wf-day__caret {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.wf-day__title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.wf-day__hours {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.wf-day__status {
  font-size: 0.78rem;
  font-weight: 500;
  min-width: 3.5rem;
  text-align: right;
}

.wf-day__tag {
  font-size: 0.78rem;
}

.wf-day__body {
  display: grid;
  gap: 0.5rem;
  padding-left: 1.35rem;
}

.wf-day__detail-row {
  display: grid;
  gap: 0.25rem;
}

.wf-day__reject {
  margin: 0;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  background: color-mix(in srgb, #dc4c42 8%, white);
  color: #dc4c42;
  font-size: 0.8rem;
}

.wf-day__detail {
  margin: 0;
  font-size: 0.83rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.wf-day__revoke {
  border: 1px solid color-mix(in srgb, #dc4c42 45%, var(--color-border));
  border-radius: 8px;
  padding: 0.15rem 0.45rem;
  background: transparent;
  color: #dc4c42;
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.wf-day__revoke:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wf-day__add {
  justify-self: start;
  border: 1px dashed var(--color-border-strong);
  border-radius: 10px;
  padding: 0.4rem 0.8rem;
  background: transparent;
  color: var(--color-primary);
  font-size: 0.82rem;
  cursor: pointer;
}
</style>
