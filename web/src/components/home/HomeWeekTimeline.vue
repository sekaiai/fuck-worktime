<script setup lang="ts">
import type { WorkDay } from '../../composables/useWeeklyReportMock';

interface Props {
  days: readonly WorkDay[];
  selectedDate: string | null;
}

interface Emits {
  (event: 'select-day', date: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isUnfilled = (day: WorkDay): boolean => !day.isWeekend && day.totalHours <= 0;
const isFilled = (day: WorkDay): boolean => !day.isWeekend && day.totalHours > 0;

const statusText = (day: WorkDay): string => {
  return day.displayStatus;
};

const dayClass = (day: WorkDay) => ({
  'day-pill': true,
  'day-pill-selected': props.selectedDate === day.date,
  'day-pill-unfilled': isUnfilled(day),
  'day-pill-filled': isFilled(day),
  'day-pill-weekend': day.isWeekend,
});

const selectDay = (date: string) => {
  emit('select-day', date);
};
</script>

<template>
  <section class="timeline" aria-label="按天工时状态">
    <header class="timeline-head">
      <h2 class="timeline-title">本周填报状态</h2>
      <p class="timeline-desc">红色为未填，绿色为已填，灰色为休息日</p>
    </header>

    <div class="timeline-strip">
      <button
        v-for="day in days"
        :key="day.date"
        :class="dayClass(day)"
        @click="selectDay(day.date)"
      >
        <span class="day-name">{{ day.dayOfWeek }}</span>
        <span class="day-date">{{ day.date.slice(5) }}</span>
        <span class="day-state">{{ statusText(day) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  margin-top: 0.9rem;
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.timeline-head {
  display: grid;
  gap: 0.25rem;
}

.timeline-title {
  margin: 0;
  color: #163932;
  font-size: 1rem;
}

.timeline-desc {
  margin: 0;
  color: #607a72;
  font-size: 0.82rem;
}

.timeline-strip {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.day-pill {
  border: 1px solid #d5e5df;
  border-radius: 0.75rem;
  background: #fbfefd;
  min-height: 6.25rem;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.2rem;
  color: #2d4d46;
  text-align: left;
  padding: 0.6rem;
}

.day-pill-filled {
  border-color: #a6d8b8;
  background: #f3fbf6;
}

.day-pill-unfilled {
  border-color: #e9b3b3;
  background: #fff7f7;
  color: #a12222;
}

.day-pill-weekend {
  border-style: dashed;
  background: #f5f8f7;
  color: #68827b;
}

.day-pill-selected {
  outline: 2px solid #1c6e5c;
  outline-offset: -2px;
}

.day-name {
  font-size: 0.9rem;
  font-weight: 700;
}

.day-date {
  font-size: 0.75rem;
}

.day-state {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
}

@media (min-width: 900px) {
  .timeline {
    padding: 1.15rem;
  }

  .timeline-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
