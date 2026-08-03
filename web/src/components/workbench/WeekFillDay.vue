<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import WeekFillRow from './WeekFillRow.vue';
import { useHomeStore } from '../../stores/home';
import type { WeekDay } from '../../types/timesheet';
import type { DayStatusResult } from '../../utils/timesheet-status';

const props = defineProps<{
  day: WeekDay;
  status: DayStatusResult;
  form: 'editable' | 'readonly' | 'future' | 'rest';
}>();

const homeStore = useHomeStore();
const { rowsByDate, rowErrors, expandedDates } = storeToRefs(homeStore);

const rows = computed(() => rowsByDate.value[props.day.date] ?? []);
const isExpanded = computed(() => expandedDates.value.includes(props.day.date));

const errorOf = computed(() => (rowId: string): string => {
  return rowErrors.value.find((error) => error.rowId === rowId)?.message ?? '';
});

/** 审核失败时展示驳回原因，取第一条非空 statusDesc */
const rejectReason = computed(
  () => props.day.details.find((detail) => detail.statusDesc)?.statusDesc ?? '',
);

const dayHours = computed(() =>
  props.form === 'editable'
    ? rows.value.reduce((sum, row) => sum + (Number.isFinite(row.hours) ? row.hours : 0), 0)
    : props.day.totalHours,
);
</script>

<template>
  <!-- 周末：单行，无交互 -->
  <div v-if="form === 'rest'" class="wf-day wf-day--muted">
    <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
    <span class="wf-day__tag">休息</span>
  </div>

  <!-- 本周未来日：单行灰字（spec §6.4） -->
  <div v-else-if="form === 'future'" class="wf-day wf-day--muted">
    <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
    <span class="wf-day__tag">未到</span>
  </div>

  <!-- 只读：待审核 / 已审核，可展开看内容但无输入控件 -->
  <div v-else-if="form === 'readonly'" class="wf-day">
    <button type="button" class="wf-day__head" @click="homeStore.toggleWeekFillDate(day.date)">
      <span class="wf-day__caret">{{ isExpanded ? '▾' : '▸' }}</span>
      <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
      <span class="wf-day__hours">{{ dayHours }}h</span>
      <span class="wf-day__status" :style="{ color: status.color }">{{ status.label }}</span>
    </button>
    <div v-if="isExpanded" class="wf-day__body">
      <p v-for="detail in day.details" :key="detail.id" class="wf-day__detail">
        <span class="wf-day__detail-hours">{{ detail.hours }}h</span>
        {{ detail.content || '无填报内容' }}
      </p>
      <p v-if="day.details.length === 0" class="wf-day__detail">无填报内容</p>
    </div>
  </div>

  <!-- 可编辑：未填报 / 审核失败 -->
  <div v-else class="wf-day">
    <button type="button" class="wf-day__head" @click="homeStore.toggleWeekFillDate(day.date)">
      <span class="wf-day__caret">{{ isExpanded ? '▾' : '▸' }}</span>
      <span class="wf-day__title">{{ day.dayOfWeek }} {{ day.date.slice(5) }}</span>
      <span class="wf-day__hours">{{ dayHours }}h</span>
      <span class="wf-day__status" :style="{ color: status.color }">{{ status.label }}</span>
    </button>

    <div v-if="isExpanded" class="wf-day__body">
      <p v-if="status.key === 'rejected' && rejectReason" class="wf-day__reject">
        驳回原因：{{ rejectReason }}
      </p>

      <WeekFillRow
        v-for="row in rows"
        :key="row.rowId"
        :row="row"
        :error-message="errorOf(row.rowId)"
      />

      <button type="button" class="wf-day__add" @click="homeStore.addWeekFillRow(day.date)">
        + 添加一条
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

.wf-day__detail-hours {
  margin-right: 0.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
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
