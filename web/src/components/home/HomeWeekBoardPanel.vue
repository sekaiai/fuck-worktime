<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';

import type { WeekDay, WorkDetail } from '../../types/timesheet';
import { useHomeStore } from '../../stores/home';
import { formatDisplayDate, getTodayKey } from '../../utils/date';
import BoardSkeleton from '../common/BoardSkeleton.vue';

const homeStore = useHomeStore();
const {
  board,
  isWeekLoading,
  errorMessage,
  weekTitle,
  weekRange,
  totalHours,
  workDays,
  averageHours,
  fillableDays,
  isCurrentWeek,
  selectedDayDate,
  selectedDay,
  days,
} = storeToRefs(homeStore);

// todayKey 必须是 computed：跨午夜后若仍是 setup 时的旧值，
// isPendingDay 会把"今天"错判为"未来日"或反之，与 useWeekBoard.fillableDays 不一致。
const todayKey = computed(() => getTodayKey());

// window.matchMedia(...).matches 不是响应式数据源，computed 永远只返回初次值。
// 改为监听 matchMedia 的 change 事件，让 isMobileView 真正随视口变化。
const isMobileView = ref(false);
let mediaQuery: MediaQueryList | null = null;
const handleMediaChange = (event: MediaQueryListEvent): void => {
  isMobileView.value = event.matches;
};

onMounted(() => {
  if (typeof window === 'undefined') return;
  mediaQuery = window.matchMedia('(max-width: 640px)');
  isMobileView.value = mediaQuery.matches;
  mediaQuery.addEventListener('change', handleMediaChange);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', handleMediaChange);
  mediaQuery = null;
});

const summaryItems = computed(() => [
  { label: '总工时', value: `${totalHours.value} h` },
  { label: '工作日', value: `${workDays.value} 天` },
  { label: '日均投入', value: `${averageHours.value} h` },
]);

function isPendingDay(day: WeekDay): boolean {
  return day.status === '未提交' && day.date <= todayKey.value;
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

  return day.displayStatus || day.status || (day.totalHours > 0 ? '已填报' : '未提交');
}

function canInspect(day: WeekDay): boolean {
  return homeStore.canInspectDay(day);
}

function getDetailKey(detail: WorkDetail, index: number): string {
  return detail.id || `${detail.period}-${index}`;
}

function shouldShowInlineDetail(day: WeekDay): boolean {
  return isMobileView.value && selectedDayDate.value === day.date && canInspect(day);
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
        <button class="board-panel__ghost" type="button" :disabled="isWeekLoading" @click="homeStore.switchWeek('previous')">
          上一周
        </button>
        <button
          class="board-panel__ghost"
          type="button"
          :disabled="isWeekLoading || isCurrentWeek"
          @click="homeStore.switchWeek('current')"
        >
          本周
        </button>
        <button class="board-panel__ghost" type="button" :disabled="isWeekLoading" @click="homeStore.switchWeek('next')">
          下一周
        </button>
      </div>
    </header>

    <BoardSkeleton v-if="isWeekLoading && !board" />
    <div v-else-if="errorMessage" class="board-panel__state board-panel__state--error">{{ errorMessage }}</div>
    <div v-else-if="days.length === 0" class="board-panel__state">本周暂无填报数据。</div>
    <template v-else>
      <div class="board-panel__summary">
        <article class="board-panel__summary-strip">
          <div v-for="item in summaryItems" :key="item.label" class="board-panel__summary-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </article>
      </div>

      <div class="board-panel__toolbar">
        <div class="board-panel__stats-mobile">
          <div class="stats-mobile__item">
            <span class="stats-mobile__value">{{ totalHours }}</span>
            <span class="stats-mobile__label">总工时</span>
          </div>
          <div class="stats-mobile__item">
            <span class="stats-mobile__value">{{ workDays }}</span>
            <span class="stats-mobile__label">工作日</span>
          </div>
          <div class="stats-mobile__item">
            <span class="stats-mobile__value">{{ averageHours }}</span>
            <span class="stats-mobile__label">日均</span>
          </div>
        </div>
        <button
          v-if="fillableDays.length > 0"
          class="board-panel__fill"
          type="button"
          @click="homeStore.openManualFill()"
        >
          立即处理剩余 {{ fillableDays.length }} 天
        </button>
      </div>

      <div class="board-panel__grid">
        <article
          v-for="day in days"
          :key="day.date"
          class="board-panel__day"
          :class="[getStateClass(day), { 'is-active': selectedDayDate === day.date, 'is-clickable': canInspect(day) }]"
          @click="homeStore.selectBoardDay(day)"
        >
          <p class="board-panel__day-name">{{ day.dayOfWeek }}</p>
          <p class="board-panel__day-date">{{ formatDisplayDate(day.date) }}</p>
          <p class="board-panel__day-status">{{ getStatusText(day) }}</p>

          <div v-if="shouldShowInlineDetail(day)" class="board-panel__detail board-panel__detail--inline">
            <div class="board-panel__detail-list">
              <article
                v-for="(detail, index) in day.details"
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
        </article>
      </div>

      <div v-if="selectedDay && !isMobileView" class="board-panel__detail">
        <header class="board-panel__detail-header">
          <div>
            <p class="board-panel__eyebrow">Day Detail</p>
            <h3 class="board-panel__detail-title">{{ selectedDay.date }} {{ selectedDay.dayOfWeek }}</h3>
            <p class="board-panel__detail-status">{{ getStatusText(selectedDay) }}</p>
          </div>
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
    </template>
  </section>
</template>

<style scoped>
.board-panel {
  display: grid;
  gap: 1rem;
  border-radius: var(--radius-2xl);
  padding: 1.35rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
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
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.board-panel__title,
.board-panel__detail-title {
  font-size: clamp(1.7rem, 4vw, 2.4rem);
}

.board-panel__detail-status {
  margin-top: 0.4rem;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.88rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.board-panel__subtitle,
.board-panel__helper {
  color: var(--color-text-secondary);
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
  transition: opacity 180ms ease;
}

.board-panel__ghost:disabled,
.board-panel__fill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.board-panel__ghost {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
}

.board-panel__fill {
  background: var(--color-primary);
  color: #ffffff;
}

.board-panel__summary {
  display: block;
}

.board-panel__summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 1rem;
  border-radius: var(--radius-xl);
  padding: 0.95rem 1rem;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.board-panel__summary-item {
  min-width: 0;
}

.board-panel__summary-item + .board-panel__summary-item {
  padding-left: 1rem;
  border-left: 1px solid var(--color-border);
}

.board-panel__summary-item span {
  display: inline-block;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.board-panel__summary-item strong {
  display: inline-block;
  margin-left: 0.55rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.board-panel__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-panel__day {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 0.9rem;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: var(--color-bg-panel);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  align-content: start;
}

.board-panel__day.is-clickable {
  cursor: pointer;
}

.board-panel__day.is-clickable:hover {
  transform: translateY(-2px);
}

.board-panel__day.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.board-panel__day.is-weekend {
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
}

.board-panel__day.is-pending {
  background: rgba(239, 154, 24, 0.12);
  color: #b45309;
}

.board-panel__day.is-future {
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
}

.board-panel__day.is-done {
  background: rgba(31, 157, 99, 0.12);
  color: #166534;
}

.board-panel__day-name,
.board-panel__day-date,
.board-panel__day-status {
  margin: 0;
}

.board-panel__day-name {
  font-family: var(--font-display);
  font-size: 0.96rem;
}

.board-panel__day-date {
  font-size: 0.84rem;
  opacity: 0.84;
}

.board-panel__day-status {
  margin-top: auto;
  padding-top: 0.42rem;
  border-top: 1px solid var(--color-border);
  font-family: var(--font-display);
  font-size: 0.73rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.88;
}

.board-panel__detail {
  display: grid;
  gap: 0.85rem;
  padding: 1.15rem;
  border-radius: var(--radius-lg);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.board-panel__detail--inline {
  margin-top: 0.85rem;
  padding: 0.85rem;
  border-radius: var(--radius-lg);
  background: var(--color-bg-soft);
}

.board-panel__detail-list {
  display: grid;
  gap: 0.7rem;
}

.board-panel__detail-item {
  border-radius: var(--radius-lg);
  padding: 0.95rem 1rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
}

.board-panel__detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
}

.board-panel__detail-content {
  margin-top: 0.55rem;
  color: var(--color-text-primary);
  line-height: 1.65;
}

.board-panel__state {
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--color-bg-soft);
}

.board-panel__state--error {
  background: rgba(220, 76, 66, 0.08);
  color: var(--color-danger);
}

@media (max-width: 1280px) {
  .board-panel__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .board-panel__header,
  .board-panel__toolbar,
  .board-panel__detail-header {
    flex-direction: column;
  }

  .board-panel__summary-strip {
    margin-left: 14px;
  }

  .board-panel__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .board-panel__stats-mobile {
    display: none;
  }
}

@media (max-width: 640px) {
  .board-panel {
    gap: 0.75rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .board-panel__header,
  .board-panel__toolbar {
    gap: 0.5rem;
    margin-left: 8px;
  }

  .board-panel__eyebrow {
    margin-bottom: 0.2rem;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .board-panel__title,
  .board-panel__detail-title {
    font-size: 1.3rem;
  }

  .board-panel__subtitle,
  .board-panel__detail-status {
    font-size: 0.86rem;
  }

  .board-panel__grid {
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }

  .board-panel__summary-strip {
    display: none;
  }

  .board-panel__stats-mobile {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }

  .stats-mobile__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stats-mobile__value {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }

  .stats-mobile__label {
    font-family: var(--font-display);
    font-size: 0.64rem;
    color: var(--color-text-tertiary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .board-panel__summary-item {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .board-panel__summary-item {
    display: grid;
    gap: 0.22rem;
  }

  .board-panel__summary-item + .board-panel__summary-item {
    padding-top: 0;
    padding-left: 0.45rem;
    border-top: 0;
    border-left: 1px solid var(--color-border);
  }

  .board-panel__summary-item strong {
    margin-left: 0;
    font-size: 0.95rem;
  }

  .board-panel__summary-item span {
    font-size: 0.64rem;
    letter-spacing: 0.06em;
  }

  .board-panel__day {
    gap: 0.2rem;
    padding: 0.65rem;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    box-shadow: none;
  }

  .board-panel__day.is-active {
    box-shadow: none;
    border-color: transparent;
  }

  .board-panel__day.is-clickable:hover {
    transform: none;
  }

  .board-panel__day-status {
    padding-top: 0.3rem;
  }

  .board-panel__detail--inline {
    margin-top: 0.5rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .board-panel__detail-list {
    gap: 0.45rem;
  }

  .board-panel__detail-item {
    padding: 0.45rem 0 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .board-panel__detail-item + .board-panel__detail-item {
    border-top: 1px dashed var(--color-border);
  }

  .board-panel__detail-content {
    margin-top: 0.3rem;
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .board-panel__state {
    padding: 0.8rem 0;
    border-radius: 0;
    background: transparent;
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
