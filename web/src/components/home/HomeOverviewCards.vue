<script setup lang="ts">
import type { WeekTab, WeeklyReportMock } from '../../composables/useWeeklyReportMock';

interface Props {
  report: WeeklyReportMock;
  activeWeek: WeekTab;
  unfilledDays: number;
}

interface Emits {
  (event: 'switch-week', week: WeekTab): void;
  (event: 'open-timesheet'): void;
  (event: 'auto-fill'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const weekButtons: Array<{ key: WeekTab; label: string }> = [
  { key: 'prev', label: '上一周' },
  { key: 'current', label: '本周' },
  { key: 'next', label: '下一周' },
];

const switchWeek = (week: WeekTab) => {
  emit('switch-week', week);
};

const openTimesheet = () => {
  emit('open-timesheet');
};

const autoFill = () => {
  emit('auto-fill');
};
</script>

<template>
  <section class="overview" aria-label="周统计概览">
    <header class="overview-head">
      <div>
        <p class="overview-label">云上工时</p>
        <h1 class="overview-title">{{ report.currentWeek }}工时 {{ report.totalHours }}h</h1>
        <p class="overview-period">{{ report.reportPeriod }}</p>
      </div>

      <div class="week-switch">
        <button
          v-for="button in weekButtons"
          :key="button.key"
          :class="['switch-button', { 'switch-button-active': button.key === activeWeek }]"
          @click="switchWeek(button.key)"
        >
          {{ button.label }}
        </button>
      </div>
    </header>

    <div v-if="unfilledDays > 0" class="action-buttons">
      <button class="fill-button" @click="openTimesheet">
        填报工时（{{ unfilledDays }}天未填）
      </button>
      <button class="auto-fill-button" @click="autoFill">
        自动填报
      </button>
    </div>
  </section>
</template>

<style scoped>
.overview {
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.overview-head {
  display: grid;
  gap: 0.75rem;
}

.overview-label {
  margin: 0;
  color: #4f6b64;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.overview-title {
  margin: 0.2rem 0 0;
  color: #153730;
  font-size: 1.35rem;
}

.overview-period {
  margin: 0.4rem 0 0;
  color: #4f6b64;
  font-size: 0.88rem;
}

.week-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.switch-button {
  border: 1px solid #c2d8ce;
  border-radius: 0.65rem;
  background: #f4faf7;
  color: #295149;
  font-size: 0.85rem;
  padding: 0.48rem 0.2rem;
}

.switch-button-active {
  border-color: #2d7d67;
  background: #2d7d67;
  color: #ffffff;
  font-weight: 700;
}

.action-buttons {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.fill-button {
  border: none;
  border-radius: 0.65rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.6rem 0.8rem;
}

.auto-fill-button {
  border: 1px solid #145848;
  border-radius: 0.65rem;
  background: #ffffff;
  color: #145848;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.6rem 0.8rem;
}

@media (min-width: 900px) {
  .overview {
    padding: 1.15rem;
  }

  .overview-head {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .week-switch {
    width: 320px;
  }
}
</style>
