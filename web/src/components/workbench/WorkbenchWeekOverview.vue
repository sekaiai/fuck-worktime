<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import { mapDayStatus } from '../../utils/timesheet-status';
import type { WeekDay } from '../../types/timesheet';

const homeStore = useHomeStore();
const { days, totalHours } = storeToRefs(homeStore);

function statusKeyOf(day: WeekDay): string {
  return mapDayStatus({ date: day.date, isWeekend: day.isWeekend, status: day.status, displayStatus: day.displayStatus }).key;
}

const stats = computed(() => {
  const count: Record<string, number> = { approved: 0, pending: 0, none: 0, rejected: 0 };
  for (const day of days.value) {
    if (day.isWeekend) continue;
    const key = statusKeyOf(day);
    if (key in count) count[key] += 1;
  }
  return [
    { label: '已审核', value: count.approved, key: 'approved' },
    { label: '待审核', value: count.pending, key: 'pending' },
    { label: '待处理', value: count.none, key: 'none' },
    { label: '审核失败', value: count.rejected, key: 'rejected' },
  ];
});

const weekList = computed(() => days.value.map((day) => ({
  key: `${day.date}-${day.dayOfWeek}`,
  date: day.date,
  dayOfWeek: day.dayOfWeek,
  hours: day.totalHours,
  statusKey: statusKeyOf(day),
})));
</script>

<template>
  <section class="wb-overview card">
    <div class="wb-overview__head">
      <p class="wb-overview__title">周状态概览</p>
      <p class="wb-overview__hours">{{ totalHours }}h <span>/ 周累计</span></p>
    </div>
    <div class="wb-overview__stats">
      <div v-for="item in stats" :key="item.label" class="wb-overview__stat">
        <span class="wb-overview__dot" :class="`is-${item.key}`"></span>
        <span class="wb-overview__stat-label">{{ item.label }}</span>
        <strong>{{ item.value }} 天</strong>
      </div>
    </div>
    <ul class="wb-overview__week">
      <li v-for="item in weekList" :key="item.key" class="wb-overview__row">
        <span class="wb-overview__dot" :class="`is-${item.statusKey}`"></span>
        <span class="wb-overview__day">{{ item.dayOfWeek }}</span>
        <span class="wb-overview__date">{{ item.date.slice(5) }}</span>
        <span class="wb-overview__h">{{ item.hours }}h</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.wb-overview { padding: 1.1rem; display: grid; gap: 0.8rem; }
.wb-overview__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; }
.wb-overview__title { margin: 0; font-family: var(--font-display); font-size: 0.95rem; font-weight: 600; }
.wb-overview__hours { margin: 0; color: var(--color-text-primary); font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; }
.wb-overview__hours span { color: var(--color-text-tertiary); font-weight: 400; font-size: 0.75rem; }
.wb-overview__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
.wb-overview__stat {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.7rem;
  border-radius: 14px;
  background: var(--color-bg-soft);
  font-size: 0.8rem;
}
.wb-overview__stat strong { font-family: var(--font-display); font-weight: 600; }
.wb-overview__stat-label { color: var(--color-text-tertiary); }
.wb-overview__dot { width: 8px; height: 8px; border-radius: 50%; }
.wb-overview__dot.is-approved { background: var(--color-success); }
.wb-overview__dot.is-pending { background: var(--color-primary); }
.wb-overview__dot.is-none { background: var(--color-text-tertiary); }
.wb-overview__dot.is-rejected { background: var(--color-danger); }
.wb-overview__dot.is-rest { border: 1.5px solid var(--color-text-tertiary); background: transparent; }
.wb-overview__week { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.35rem; }
.wb-overview__row {
  display: grid;
  grid-template-columns: auto 1.6rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 12px;
  font-size: 0.82rem;
}
.wb-overview__row:nth-child(odd) { background: var(--color-bg-soft); }
.wb-overview__day { font-weight: 500; }
.wb-overview__date { color: var(--color-text-tertiary); }
.wb-overview__h { font-family: var(--font-display); font-weight: 600; }
</style>
