<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import { formatDateKey, getTodayKey, shiftDateKeyByDays } from '../../utils/date';
import { mapDayStatus } from '../../utils/timesheet-status';
import type { WeekDay } from '../../types/timesheet';

const homeStore = useHomeStore();
const { days, weekRange, isWeekLoading } = storeToRefs(homeStore);

interface CalCell {
  date: string;
  day: number;
  inMonth: boolean;
  statusKey: string;
  label: string;
}

const todayKey = getTodayKey();

const monthTitle = computed(() => {
  const anchor = days.value.length > 0 ? days.value[0].date : getTodayKey();
  const [y, m] = anchor.split('-').map(Number);
  return `${y} 年 ${m} 月`;
});

const monthStartKey = computed(() => {
  const anchor = days.value.length > 0 ? days.value[0].date : getTodayKey();
  const [y, m] = anchor.split('-').map(Number);
  return formatDateKey(new Date(y, m - 1, 1));
});

const leadingOffset = computed(() => {
  const d = new Date(`${monthStartKey.value}T00:00:00`);
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
});

const weekStart = computed(() => (days.value.length > 0 ? days.value[0].date : getTodayKey()));

const dayMap = computed(() => {
  const map = new Map<string, WeekDay>();
  for (const day of days.value) {
    map.set(day.date, day);
  }
  return map;
});

const cells = computed<CalCell[]>(() => {
  const result: CalCell[] = [];
  const startOffset = leadingOffset.value;
  const first = new Date(`${monthStartKey.value}T00:00:00`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 0; i < 42; i += 1) {
    const dateKey = shiftDateKeyByDays(monthStartKey.value, i - startOffset);
    const dayNum = Number(dateKey.slice(-2));
    const inMonth = i >= startOffset && i < startOffset + daysInMonth;
    const day = dayMap.value.get(dateKey);
    const status = day
      ? mapDayStatus({ date: day.date, isWeekend: day.isWeekend, status: day.status, displayStatus: day.displayStatus })
      : null;
    result.push({
      date: dateKey,
      day: dayNum,
      inMonth,
      statusKey: status?.key ?? 'none',
      label: status?.label ?? '',
    });
  }
  return result;
});

const isInCurrentWeek = (date: string): boolean => {
  if (!days.value.length) return false;
  const [start, end] = [weekStart.value, shiftDateKeyByDays(weekStart.value, 6)];
  return date >= start && date <= end;
};

const legend = [
  { key: 'none', label: '未填报' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已审核' },
  { key: 'rejected', label: '审核失败' },
  { key: 'rest', label: '休息日' },
];
</script>

<template>
  <section class="wb-cal card">
    <div class="wb-cal__head">
      <p class="wb-cal__title">{{ monthTitle }}</p>
      <span class="wb-cal__week">{{ weekRange }}</span>
    </div>
    <div class="wb-cal__weekdays">
      <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</span>
    </div>
    <div v-if="isWeekLoading" class="wb-cal__state">加载中...</div>
    <div v-else class="wb-cal__grid">
      <div
        v-for="cell in cells"
        :key="cell.date"
        class="wb-cal__cell"
        :class="[
          { 'is-muted': !cell.inMonth, 'is-today': cell.date === todayKey, 'is-week': isInCurrentWeek(cell.date) },
          `is-${cell.statusKey}`,
        ]"
        :title="`${cell.date} ${cell.label}`"
      >
        <span class="wb-cal__num">{{ cell.day }}</span>
        <span class="wb-cal__dot"></span>
      </div>
    </div>
    <div class="wb-cal__legend">
      <span v-for="item in legend" :key="item.key" class="wb-cal__legend-item">
        <span class="wb-cal__dot" :class="`is-${item.key}`"></span>
        {{ item.label }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.wb-cal { padding: 1.1rem; }
.wb-cal__head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.wb-cal__title { margin: 0; font-family: var(--font-display); font-size: 0.95rem; font-weight: 600; }
.wb-cal__week { color: var(--color-text-tertiary); font-size: 0.78rem; }
.wb-cal__weekdays {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 0.72rem;
}
.wb-cal__grid { margin-top: 0.35rem; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.2rem; }
.wb-cal__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  height: 2.2rem;
  border-radius: 10px;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.wb-cal__cell.is-muted { color: var(--color-text-tertiary); opacity: 0.5; }
.wb-cal__cell.is-week { background: var(--color-primary-soft); }
.wb-cal__cell.is-today { outline: 1.5px solid var(--color-primary); outline-offset: -1px; }
.wb-cal__dot { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
.wb-cal__dot.is-none { background: var(--color-text-tertiary); }
.wb-cal__dot.is-pending { background: var(--color-primary); }
.wb-cal__dot.is-approved { background: var(--color-success); }
.wb-cal__dot.is-rejected { background: var(--color-danger); }
.wb-cal__dot.is-rest { border: 1.5px solid var(--color-text-tertiary); background: transparent; }
.wb-cal__legend { margin-top: 0.7rem; display: flex; flex-wrap: wrap; gap: 0.5rem 0.7rem; color: var(--color-text-tertiary); font-size: 0.72rem; }
.wb-cal__legend-item { display: inline-flex; align-items: center; gap: 0.3rem; }
.wb-cal__state { margin-top: 0.7rem; padding: 0.8rem; text-align: center; color: var(--color-text-tertiary); background: var(--color-bg-soft); border-radius: 12px; }
</style>
