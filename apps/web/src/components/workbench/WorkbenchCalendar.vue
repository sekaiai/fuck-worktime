<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import type { CalendarDayCell } from '../../types/calendar';
import { shiftDateKeyByDays } from '../../utils/date';

const homeStore = useHomeStore();
const {
  calendarWeeks,
  calendarMonthLabel,
  isCalendarLoading,
  calendarErrorMessage,
  currentDate,
  expandedDates,
} = storeToRefs(homeStore);

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const LEGEND_ITEMS: { className: string; label: string }[] = [
  { className: 'wfa-cal__dot--approved', label: '已通过' },
  { className: 'wfa-cal__dot--pending', label: '待审核' },
  { className: 'wfa-cal__dot--rejected', label: '审核失败' },
  { className: 'wfa-cal__dot--none', label: '未提交' },
  { className: 'wfa-cal__dot--rest', label: '休息日' },
];

/** 当前查看周的日期集合，用于整行高亮与「已展开」判定 */
const viewingWeekDates = computed(() => {
  const start = currentDate.value;
  return new Set(Array.from({ length: 7 }, (_, index) => shiftDateKeyByDays(start, index)));
});

function isCurrentRow(row: CalendarDayCell[]): boolean {
  return row.some((cell) => viewingWeekDates.value.has(cell.dateKey));
}

function dotClass(cell: CalendarDayCell): string {
  if (cell.isWeekend) {
    return 'wfa-cal__dot--rest';
  }

  if (cell.statusKey === 'approved') {
    return 'wfa-cal__dot--approved';
  }
  if (cell.statusKey === 'pending') {
    return 'wfa-cal__dot--pending';
  }
  if (cell.statusKey === 'rejected') {
    return 'wfa-cal__dot--rejected';
  }
  return 'wfa-cal__dot--none';
}

/** 休息日与补位日期不参与周定位，避免误切到不可填报的周 */
function isClickable(cell: CalendarDayCell): boolean {
  return cell.inCurrentMonth && !cell.isWeekend;
}

function cellTitle(cell: CalendarDayCell): string {
  const hours = cell.hours > 0 ? `${cell.hours}h` : '无填报';
  return `${cell.dateKey} · ${cell.hours > 0 ? `${hours} · ${cell.statusLabel}` : hours}`;
}

function onCellClick(cell: CalendarDayCell): void {
  void homeStore.focusCalendarDate(cell.dateKey);
}
</script>

<template>
  <section class="wfa-card wfa-cal-card">
    <div class="wfa-card__head">
      <p class="wfa-card__title">日历</p>
      <span class="wfa-card__hint">点击定位到当天</span>
    </div>

    <div class="wfa-cal">
      <div class="wfa-cal__bar">
        <button
          type="button"
          class="wfa-cal__nav"
          aria-label="上一月"
          :disabled="isCalendarLoading"
          @click="homeStore.shiftCalendarMonth(-1)"
        >‹</button>
        <p class="wfa-cal__month">{{ calendarMonthLabel }}</p>
        <button
          type="button"
          class="wfa-cal__nav"
          aria-label="下一月"
          :disabled="isCalendarLoading"
          @click="homeStore.shiftCalendarMonth(1)"
        >›</button>
      </div>

      <div class="wfa-cal__week" aria-hidden="true">
        <span v-for="label in WEEK_LABELS" :key="label">{{ label }}</span>
      </div>

      <div class="wfa-cal__rows" :class="{ 'is-loading': isCalendarLoading }">
        <div
          v-for="(row, rowIndex) in calendarWeeks"
          :key="rowIndex"
          class="wfa-cal__row"
          :class="{ 'wfa-cal__row--current': isCurrentRow(row) }"
        >
          <template v-for="cell in row" :key="cell.dateKey">
            <button
              v-if="isClickable(cell)"
              type="button"
              class="wfa-cal__cell"
              :class="{
                'is-active': expandedDates.includes(cell.dateKey),
                'is-today': cell.isToday,
              }"
              :title="cellTitle(cell)"
              @click="onCellClick(cell)"
            >
              <span class="wfa-cal__num">{{ cell.dayOfMonth }}</span>
              <span class="wfa-cal__dot" :class="dotClass(cell)" aria-hidden="true"></span>
            </button>

            <span
              v-else-if="cell.inCurrentMonth"
              class="wfa-cal__cell wfa-cal__cell--rest"
              :title="cellTitle(cell)"
            >
              <span class="wfa-cal__num">{{ cell.dayOfMonth }}</span>
              <span class="wfa-cal__dot wfa-cal__dot--rest" aria-hidden="true"></span>
            </span>

            <span v-else class="wfa-cal__cell wfa-cal__cell--out" aria-hidden="true">
              {{ cell.dayOfMonth }}
            </span>
          </template>
        </div>
      </div>

      <p v-if="calendarErrorMessage && !isCalendarLoading" class="wfa-cal__error">
        {{ calendarErrorMessage }}
        <button type="button" class="wfa-cal__retry" @click="homeStore.loadMonthCalendar()">
          重试
        </button>
      </p>

      <div class="wfa-cal__legend">
        <span v-for="item in LEGEND_ITEMS" :key="item.label" class="wfa-cal__legend-item">
          <span class="wfa-cal__dot" :class="item.className" aria-hidden="true"></span>
          {{ item.label }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wfa-cal-card {
  /* 日历是左栏主视图，给出稳定高度避免切换月份时整页抖动 */
  min-height: 0;
}

.wfa-cal {
  display: grid;
  gap: 0.5rem;
}

.wfa-cal__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wfa-cal__month {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.wfa-cal__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
}

.wfa-cal__nav:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wfa-cal__week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.2rem;
}

.wfa-cal__week span {
  text-align: center;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.wfa-cal__rows {
  display: grid;
  gap: 0.2rem;
  transition: opacity 160ms ease;
}

.wfa-cal__rows.is-loading {
  opacity: 0.55;
}

.wfa-cal__row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.2rem;
  padding: 0.1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
}

/* 当前查看周：与顶栏「本周」同一语义，整行加浅色带 */
.wfa-cal__row--current {
  background: color-mix(in srgb, var(--color-primary) 5%, white);
  border-color: color-mix(in srgb, var(--color-primary) 18%, white);
}

.wfa-cal__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-width: 0;
  height: 2.15rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  font-family: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.wfa-cal__num {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.wfa-cal__dot {
  flex-shrink: 0;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 999px;
  background: transparent;
}

.wfa-cal__dot--approved {
  background: var(--color-success);
}

.wfa-cal__dot--pending {
  background: var(--color-primary);
}

.wfa-cal__dot--rejected {
  background: var(--color-danger);
}

.wfa-cal__dot--none {
  background: var(--color-text-tertiary);
}

.wfa-cal__dot--rest {
  background: transparent;
  border: 1px solid var(--color-border);
}

/* is-active = 右栏已展开的日块 */
.wfa-cal__cell.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 38%, white);
  background: var(--color-bg-panel);
  color: var(--color-primary);
}

/* is-today = 今天 */
.wfa-cal__cell.is-today {
  border-color: var(--color-border-strong);
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
}

.wfa-cal__cell.is-today .wfa-cal__num {
  font-weight: 700;
}

.wfa-cal__cell--rest {
  color: var(--color-text-tertiary);
  cursor: default;
}

.wfa-cal__cell--rest .wfa-cal__num {
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.wfa-cal__cell--out {
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--color-text-tertiary) 45%, white);
  font-size: 0.78rem;
  cursor: default;
}

.wfa-cal__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-panel));
  color: var(--color-danger);
  font-size: 0.74rem;
  line-height: 1.5;
}

.wfa-cal__retry {
  flex-shrink: 0;
  border: 0;
  padding: 0.15rem 0.3rem;
  background: transparent;
  color: var(--color-danger);
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.wfa-cal__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px dashed var(--color-border);
}

.wfa-cal__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  color: var(--color-text-tertiary);
}
</style>
