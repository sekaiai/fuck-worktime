<script setup lang="ts">
import type { WeekBoardResponse } from '../../types/timesheet';
import { formatDisplayDate } from '../../utils/date';

defineProps<{
  board: WeekBoardResponse | null;
  isLoading: boolean;
  errorMessage: string;
  weekTitle: string;
  weekRange: string;
  totalHours: number;
  workDays: number;
  averageHours: number;
}>();

defineEmits<{
  refresh: [];
}>();

function getStateClass(day: WeekBoardResponse['days'][number]): string {
  if (day.isWeekend) {
    return 'is-weekend';
  }
  if (day.status === '未提交' && day.date <= new Date().toLocaleDateString('en-CA')) {
    return 'is-pending';
  }
  if (day.status === '未提交') {
    return 'is-future';
  }
  return 'is-done';
}

function getStatusText(day: WeekBoardResponse['days'][number]): string {
  if (day.isWeekend) {
    return '休息日';
  }
  return day.status;
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
      <button class="board-panel__refresh" type="button" :disabled="isLoading" @click="$emit('refresh')">
        {{ isLoading ? '刷新中...' : '刷新' }}
      </button>
    </header>

    <div v-if="errorMessage" class="board-panel__state board-panel__state--error">{{ errorMessage }}</div>
    <div v-else-if="isLoading && !board" class="board-panel__state">正在获取本周状态...</div>
    <div v-else-if="!board || board.days.length === 0" class="board-panel__state">本周暂无填报数据。</div>
    <template v-else>
      <div class="board-panel__grid">
        <article
          v-for="day in board.days"
          :key="day.date"
          class="board-panel__day"
          :class="getStateClass(day)"
        >
          <p class="board-panel__day-name">{{ day.dayOfWeek }}</p>
          <p class="board-panel__day-date">{{ formatDisplayDate(day.date) }}</p>
          <p class="board-panel__day-status">{{ getStatusText(day) }}</p>
          <p v-if="!day.isWeekend" class="board-panel__day-hours">{{ day.totalHours }}h</p>
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

.board-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.board-panel__eyebrow,
.board-panel__range {
  margin: 0;
  color: #6d7067;
}

.board-panel__title {
  margin: 0.25rem 0;
  font-size: 1.2rem;
  color: #13272c;
}

.board-panel__refresh {
  border: 0;
  border-radius: 999px;
  background: #0f4f53;
  color: #fff;
  padding: 0.7rem 1rem;
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
.board-panel__day-hours {
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

.board-panel__day-status {
  margin-top: 0.5rem;
  font-size: 0.92rem;
}

.board-panel__summary {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-panel__summary div {
  border-radius: 18px;
  background: #f7f2e8;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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

@media (min-width: 900px) {
  .board-panel__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
