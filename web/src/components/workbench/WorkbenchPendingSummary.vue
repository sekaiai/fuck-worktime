<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import { formatDisplayDate } from '../../utils/date';
import { mapDayStatus } from '../../utils/timesheet-status';

const homeStore = useHomeStore();
const { fillableDays, days } = storeToRefs(homeStore);

const rejectedDays = computed(() => days.value.filter((day) => {
  const s = mapDayStatus({ date: day.date, isWeekend: day.isWeekend, status: day.status, displayStatus: day.displayStatus });
  return s.key === 'rejected';
}));

const items = computed(() => [
  ...rejectedDays.value.map((day) => ({
    key: `rejected-${day.date}`,
    tone: 'danger',
    text: `${formatDisplayDate(day.date)}（${day.dayOfWeek}）审核失败，请修正后重新提交。`,
  })),
  ...fillableDays.value.map((day) => ({
    key: `pending-${day.date}`,
    tone: 'warning',
    text: `${formatDisplayDate(day.date)}（${day.dayOfWeek}）仍未填报，待补填。`,
  })),
]);
</script>

<template>
  <section v-if="items.length > 0" class="wb-pending card">
    <div class="wb-pending__head">
      <p class="wb-pending__title">待处理摘要</p>
      <span class="wb-pending__count">{{ items.length }} 项</span>
    </div>
    <ul class="wb-pending__list">
      <li v-for="item in items" :key="item.key" class="wb-pending__item" :class="`is-${item.tone}`">
        <span class="wb-pending__dot"></span>
        <span>{{ item.text }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.wb-pending { padding: 1.1rem; display: grid; gap: 0.7rem; }
.wb-pending__head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.wb-pending__title { margin: 0; font-family: var(--font-display); font-size: 0.95rem; font-weight: 600; }
.wb-pending__count { color: var(--color-warning); font-size: 0.82rem; }
.wb-pending__list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.45rem; }
.wb-pending__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: 14px;
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  line-height: 1.55;
}
.wb-pending__item.is-danger { background: rgba(220, 76, 66, 0.08); color: var(--color-danger); }
.wb-pending__item.is-warning { background: rgba(239, 154, 24, 0.08); color: #b45309; }
.wb-pending__dot { flex-shrink: 0; margin-top: 0.35rem; width: 7px; height: 7px; border-radius: 50%; }
.wb-pending__item.is-danger .wb-pending__dot { background: var(--color-danger); }
.wb-pending__item.is-warning .wb-pending__dot { background: var(--color-warning); }
</style>
