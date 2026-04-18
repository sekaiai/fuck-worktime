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

const days = computed(() => props.board?.days ?? []);
const selectedDay = computed(() => days.value.find((day) => day.date === selectedDayDate.value) ?? null);
const summaryItems = computed(() => [
  { label: '总工时', value: `${props.totalHours} h` },
  { label: '工作日', value: `${props.workDays} 天` },
  { label: '日均投入', value: `${props.averageHours} h` },
]);

watch(
  days,
  (list) => {
    const stillExists = list.some((day) => day.date === selectedDayDate.value);
    if (stillExists) {
      return;
    }

    const firstFilledDay = list.find((day) => canInspect(day));
    selectedDayDate.value = firstFilledDay?.date ?? '';
  },
  { immediate: true },
);

function isPendingDay(day: WeekDay): boolean {
  return day.status === '未提交' && day.date <= todayKey;
}

function getStateClass(day: WeekDay): string {
  if (day.isWeekend) {
    return 'is-weekend';
  }
  if (isPendingDay(day)) {
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

  return day.status || (day.totalHours > 0 ? '已填报' : '未提交');
}

function getDayHint(day: WeekDay): string {
  if (day.isWeekend) {
    return '';
  }
  if (day.totalHours > 0) {
    return `${day.totalHours} h`;
  }
  return day.date <= todayKey ? '待填报' : '待开放';
}

function canInspect(day: WeekDay): boolean {
  return !day.isWeekend && day.details.length > 0 && day.status !== '未提交';
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
  <section class="board-panel">
    <header class="board-panel__header">
      <div class="board-panel__heading">
        <p class="board-panel__eyebrow">Weekly Board</p>
        <h2 class="board-panel__title">{{ weekTitle }}</h2>
        <p class="board-panel__subtitle">{{ weekRange || board?.weekRange || '等待周区间数据' }}</p>
      </div>

      <div class="board-panel__actions">
        <button class="board-panel__ghost" type="button" :disabled="isLoading" @click="emit('previousWeek')">
          上一周
        </button>
        <button
          class="board-panel__ghost"
          type="button"
          :disabled="isLoading || isCurrentWeek"
          @click="emit('currentWeek')"
        >
          本周
        </button>
        <button class="board-panel__ghost" type="button" :disabled="isLoading" @click="emit('nextWeek')">
          下一周
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="board-panel__state board-panel__state--error">{{ errorMessage }}</div>
    <div v-else-if="isLoading && !board" class="board-panel__state">正在获取本周状态...</div>
    <div v-else-if="days.length === 0" class="board-panel__state">本周暂无填报数据。</div>
    <template v-else>
      <div class="board-panel__summary">
        <article v-for="item in summaryItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>

      <div class="board-panel__toolbar">
        <p class="board-panel__helper">点击已填报日期可查看具体内容和时间段。</p>
        <button
          v-if="fillableCount > 0"
          class="board-panel__fill"
          type="button"
          @click="emit('openManualFill')"
        >
          立即处理剩余 {{ fillableCount }} 天
        </button>
      </div>

      <div class="board-panel__body">
        <div class="board-panel__grid">
          <article
            v-for="day in days"
            :key="day.date"
            class="board-panel__day"
            :class="[getStateClass(day), { 'is-active': selectedDayDate === day.date, 'is-clickable': canInspect(day) }]"
            @click="selectDay(day)"
          >
            <p class="board-panel__day-name">{{ day.dayOfWeek }}</p>
            <p class="board-panel__day-date">{{ formatDisplayDate(day.date) }}</p>
            <p class="board-panel__day-status">{{ getStatusText(day) }}</p>
            <p v-if="getDayHint(day)" class="board-panel__day-hours">{{ getDayHint(day) }}</p>
          </article>
        </div>

        <div v-if="selectedDay" class="board-panel__detail">
          <header class="board-panel__detail-header">
            <div>
              <p class="board-panel__eyebrow">Day Detail</p>
              <h3 class="board-panel__detail-title">{{ selectedDay.date }} {{ selectedDay.dayOfWeek }}</h3>
            </div>
            <span class="board-panel__detail-badge">{{ getStatusText(selectedDay) }}</span>
          </header>

          <div class="board-panel__detail-list">
            <article
              v-for="(detail, index) in selectedDay.details"
              :key="getDetailKey(detail, index)"
              class="board-panel__detail-item"
            >
              <div class="board-panel__detail-meta">
                <span>{{ detail.hours }} h</span>
                <span v-if="detail.period">{{ detail.period }}</span>
                <span>{{ detail.statusDesc || detail.status }}</span>
              </div>
              <p class="board-panel__detail-content">{{ detail.content || '无填报内容' }}</p>
            </article>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.board-panel {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 30px;
  padding: 1.25rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.84), rgba(240, 233, 224, 0.72));
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.1);
}

.board-panel__header,
.board-panel__toolbar,
.board-panel__detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.board-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.board-panel__title,
.board-panel__detail-title {
  font-size: clamp(1.7rem, 4vw, 2.4rem);
}

.board-panel__subtitle,
.board-panel__helper {
  color: var(--ink-soft);
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
  min-height: 2.9rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
}

.board-panel__ghost {
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

.board-panel__fill {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.board-panel__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.board-panel__summary article,
.board-panel__detail-item {
  border-radius: 20px;
  padding: 0.95rem 1rem;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.board-panel__summary span {
  display: block;
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.board-panel__summary strong {
  display: block;
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.board-panel__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr);
  gap: 1rem;
}

.board-panel__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-panel__day {
  display: grid;
  gap: 0.15rem;
  min-height: 7.8rem;
  padding: 1rem;
  border-radius: 22px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.4);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.board-panel__day.is-clickable {
  cursor: pointer;
}

.board-panel__day.is-clickable:hover {
  transform: translateY(-2px);
}

.board-panel__day.is-active {
  border-color: rgba(35, 76, 75, 0.32);
  box-shadow: 0 0 0 1px rgba(35, 76, 75, 0.12);
}

.board-panel__day.is-weekend {
  background: rgba(226, 221, 212, 0.72);
  color: #6d6a66;
}

.board-panel__day.is-pending {
  background: rgba(255, 233, 195, 0.78);
  color: #815711;
}

.board-panel__day.is-future {
  background: rgba(246, 243, 239, 0.86);
  color: #8b867d;
}

.board-panel__day.is-done {
  background: rgba(222, 240, 228, 0.82);
  color: #255948;
}

.board-panel__day-name,
.board-panel__day-date,
.board-panel__day-status,
.board-panel__day-hours {
  margin: 0;
}

.board-panel__day-name {
  font-family: var(--font-display);
  font-size: 1rem;
}

.board-panel__day-date {
  font-size: 0.86rem;
}

.board-panel__day-status {
  margin-top: auto;
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.08em;
}

.board-panel__day-hours {
  font-size: 0.88rem;
}

.board-panel__detail {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 24px;
  background: rgba(246, 242, 234, 0.88);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.board-panel__detail-badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.85rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
}

.board-panel__detail-list {
  display: grid;
  gap: 0.7rem;
}

.board-panel__detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
}

.board-panel__detail-content {
  margin-top: 0.55rem;
  color: var(--ink-strong);
  line-height: 1.65;
}

.board-panel__state {
  border-radius: 22px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
}

.board-panel__state--error {
  background: rgba(170, 71, 55, 0.08);
  color: var(--danger);
}

@media (max-width: 1120px) {
  .board-panel__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .board-panel__grid,
  .board-panel__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .board-panel__header,
  .board-panel__toolbar,
  .board-panel__detail-header {
    flex-direction: column;
  }

  .board-panel__grid,
  .board-panel__summary {
    grid-template-columns: 1fr;
  }

  .board-panel__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .board-panel__fill {
    width: 100%;
  }
}
</style>
