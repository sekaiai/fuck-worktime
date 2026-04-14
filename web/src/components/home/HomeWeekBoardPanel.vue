<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import type { WeekBoardResponse, WeekDay, WorkDetail } from '../../types/timesheet';
import { formatDisplayDate, getTodayKey } from '../../utils/date';

const props = defineProps<{
  board: WeekBoardResponse | null;
  isLoading: boolean;
  errorMessage: string;
  weekTitle: string;
  weekRange: string;
  totalHours: number;
  workDays: number;
  averageHours: number;
  fillableCount: number;
  canGoNextWeek: boolean;
  isCurrentWeek: boolean;
}>();

const emit = defineEmits<{
  previousWeek: [];
  currentWeek: [];
  nextWeek: [];
  openManualFill: [];
}>();

const selectedDayDate = shallowRef('');
const todayKey = getTodayKey();

const selectedDay = computed(() =>
  props.board?.days.find((day) => day.date === selectedDayDate.value) ?? null,
);

watch(
  () => props.board?.days,
  (days) => {
    const list = days ?? [];
    const stillExists = list.some((day) => day.date === selectedDayDate.value);
    if (stillExists) {
      return;
    }

    const firstFilledDay = list.find((day) => !day.isWeekend && day.status !== '未提交' && day.details.length > 0);
    selectedDayDate.value = firstFilledDay?.date ?? '';
  },
  { immediate: true },
);

function getStateClass(day: WeekDay): string {
  if (day.isWeekend) {
    return 'is-weekend';
  }
  if (day.status === '未提交' && day.date <= todayKey) {
    return 'is-pending';
  }
  if (day.status === '未提交') {
    return 'is-future';
  }
  return 'is-done';
}

function getStatusText(day: WeekDay): string {
  if (day.isWeekend) {
    return '休息日';
  }

  return day.status;
}

function canInspect(day: WeekDay): boolean {
  return !day.isWeekend && day.status !== '未提交' && day.details.length > 0;
}

function selectDay(day: WeekDay): void {
  if (!canInspect(day)) {
    return;
  }

  selectedDayDate.value = day.date;
}

function getDetailKey(detail: WorkDetail, index: number): string {
  return detail.id || `${detail.period}-${index}`;
}
</script>

<template>
  <section class="panel board-panel">
    <header class="board-panel__header">
      <div>
        <p class="board-panel__eyebrow">{{ weekTitle }}</p>
        <h2 class="board-panel__title">本周填报状态</h2>
        <p class="board-panel__range">{{ weekRange || '等待加载周范围' }}</p>
      </div>

      <div class="board-panel__actions">
        <button class="board-panel__ghost" type="button" :disabled="isLoading" @click="emit('previousWeek')">
          上一周
        </button>
        <button class="board-panel__ghost" type="button" :disabled="isLoading || isCurrentWeek" @click="emit('currentWeek')">
          本周
        </button>
        <button
          class="board-panel__ghost"
          type="button"
          :disabled="isLoading || !canGoNextWeek"
          @click="emit('nextWeek')"
        >
          下一周
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="board-panel__state board-panel__state--error">{{ errorMessage }}</div>
    <div v-else-if="isLoading && !board" class="board-panel__state">正在获取本周状态...</div>
    <div v-else-if="!board || board.days.length === 0" class="board-panel__state">本周暂无填报数据。</div>
    <template v-else>
      <div class="board-panel__toolbar">
        <button
          v-if="fillableCount > 0"
          class="board-panel__fill board-panel__fill--mobile-sticky"
          type="button"
          @click="emit('openManualFill')"
        >
          填报工时（{{ fillableCount }}天）
        </button>
        <span v-else class="board-panel__helper">当前这周没有可补填的工作日。</span>
      </div>

      <div class="board-panel__grid">
        <article
          v-for="day in board.days"
          :key="day.date"
          class="board-panel__day"
          :class="[getStateClass(day), { 'is-active': selectedDayDate === day.date, 'is-clickable': canInspect(day) }]"
          @click="selectDay(day)"
        >
          <p class="board-panel__day-name">{{ day.dayOfWeek }}</p>
          <p class="board-panel__day-date">{{ formatDisplayDate(day.date) }}</p>
          <p class="board-panel__day-status">{{ getStatusText(day) }}</p>
          <p v-if="!day.isWeekend" class="board-panel__day-hours">{{ day.totalHours }}h</p>
          <p v-if="canInspect(day)" class="board-panel__day-tip">点击查看已填内容</p>
        </article>
      </div>

      <div class="board-panel__summary">
        <div>
          <strong>{{ totalHours }}</strong>
          <span>总工时</span>
        </div>
        <div>
          <strong>{{ workDays }}</strong>
          <span>工作天数</span>
        </div>
        <div>
          <strong>{{ averageHours }}</strong>
          <span>平均工时</span>
        </div>
      </div>

      <div v-if="selectedDay" class="board-panel__detail">
        <header class="board-panel__detail-header">
          <div>
            <p class="board-panel__detail-eyebrow">已填报内容</p>
            <h3 class="board-panel__detail-title">
              {{ formatDisplayDate(selectedDay.date) }} {{ selectedDay.dayOfWeek }}
            </h3>
          </div>
          <span class="board-panel__detail-status">{{ selectedDay.status }}</span>
        </header>

        <div class="board-panel__detail-list">
          <article
            v-for="(detail, index) in selectedDay.details"
            :key="getDetailKey(detail, index)"
            class="board-panel__detail-item"
          >
            <div class="board-panel__detail-meta">
              <span>{{ detail.hours }}h</span>
              <span v-if="detail.period">{{ detail.period }}</span>
              <span>{{ detail.statusDesc || detail.status }}</span>
            </div>
            <p class="board-panel__detail-content">{{ detail.content || '无填报内容' }}</p>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  padding: 1.1rem;
  box-shadow: 0 16px 36px rgba(15, 61, 62, 0.08);
}

.board-panel__header,
.board-panel__toolbar,
.board-panel__detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.board-panel__eyebrow,
.board-panel__range,
.board-panel__helper,
.board-panel__detail-eyebrow {
  margin: 0;
  color: #6d7067;
}

.board-panel__title,
.board-panel__detail-title {
  margin: 0.25rem 0;
  color: #13272c;
}

.board-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.board-panel__ghost,
.board-panel__fill {
  border: 0;
  border-radius: 999px;
  padding: 0.7rem 1rem;
  font-size: 0.92rem;
}

.board-panel__ghost {
  background: #ece8df;
  color: #24383f;
}

.board-panel__fill {
  background: #0f4f53;
  color: #fff;
}

.board-panel__toolbar {
  margin-top: 1rem;
}

.board-panel__grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-panel__day {
  border-radius: 18px;
  padding: 0.9rem;
  background: #f4f1ea;
  border: 1px solid transparent;
}

.board-panel__day.is-clickable {
  cursor: pointer;
}

.board-panel__day.is-active {
  border-color: #0f4f53;
  box-shadow: 0 0 0 2px rgba(15, 79, 83, 0.12);
}

.board-panel__day.is-weekend {
  background: #efebe3;
  color: #777;
}

.board-panel__day.is-pending {
  background: #fff2d9;
  color: #885f00;
}

.board-panel__day.is-future {
  background: #f7f6f3;
  color: #888;
}

.board-panel__day.is-done {
  background: #e8f5ee;
  color: #16553e;
}

.board-panel__day-name,
.board-panel__day-date,
.board-panel__day-status,
.board-panel__day-hours,
.board-panel__day-tip {
  margin: 0;
}

.board-panel__day-name {
  font-weight: 700;
}

.board-panel__day-date,
.board-panel__day-hours {
  margin-top: 0.25rem;
  font-size: 0.86rem;
}

.board-panel__day-status,
.board-panel__day-tip {
  margin-top: 0.45rem;
  font-size: 0.88rem;
}

.board-panel__day-tip {
  opacity: 0.85;
}

.board-panel__summary {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-panel__summary div,
.board-panel__detail-item {
  border-radius: 18px;
  background: #f7f2e8;
  padding: 0.85rem;
}

.board-panel__summary strong {
  font-size: 1.2rem;
  color: #13272c;
}

.board-panel__summary span {
  color: #6d7067;
  font-size: 0.86rem;
}

.board-panel__state {
  margin-top: 1rem;
  border-radius: 18px;
  padding: 1rem;
  background: #f4f1ea;
}

.board-panel__state--error {
  background: #fff0ee;
  color: #b42318;
}

.board-panel__detail {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 20px;
  background: #fbf8f2;
  display: grid;
  gap: 0.75rem;
}

.board-panel__detail-status {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: #e8f5ee;
  color: #16553e;
}

.board-panel__detail-list {
  display: grid;
  gap: 0.75rem;
}

.board-panel__detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #6d7067;
  font-size: 0.86rem;
}

.board-panel__detail-content {
  margin: 0.65rem 0 0;
  color: #13272c;
  line-height: 1.6;
}

@media (max-width: 680px) {
  .board-panel__grid {
    grid-template-columns: 1fr;
  }

  .board-panel__fill--mobile-sticky {
    position: sticky;
    bottom: 0.7rem;
    z-index: 10;
    width: 100%;
  }

  .board-panel__header,
  .board-panel__toolbar,
  .board-panel__detail-header {
    flex-direction: column;
  }

  .board-panel__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .board-panel__summary {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 900px) {
  .board-panel__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
