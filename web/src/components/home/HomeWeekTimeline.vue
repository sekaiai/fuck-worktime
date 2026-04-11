<script setup lang="ts">
import type { WeekDay } from '../../types/timesheet';

defineProps<{
  days: WeekDay[];
  totalHours: number;
  workDays: number;
  averageHours: number;
  isLoading: boolean;
  error: string | null;
}>();

defineEmits<{
  refresh: [];
}>();

const today = new Date().toISOString().split('T')[0];

function getDayClass(day: WeekDay): string {
  if (day.isWeekend) return 'week-timeline__day--weekend';
  if (day.status === '未提交' && day.date <= today) return 'week-timeline__day--unfilled';
  if (day.status === '未提交') return 'week-timeline__day--future';
  return 'week-timeline__day--filled';
}

function getStatusText(day: WeekDay): string {
  if (day.isWeekend) return '休息日';
  if (day.status === '未提交') return '未提交';
  return day.status;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<template>
  <section class="week-timeline">
    <div class="week-timeline__header">
      <h3 class="week-timeline__title">本周填报状态</h3>
      <nut-button type="default" size="small" :loading="isLoading" @click="$emit('refresh')">
        刷新
      </nut-button>
    </div>

    <div v-if="isLoading && days.length === 0" class="week-timeline__loading">
      <div class="week-timeline__skeleton" v-for="i in 7" :key="i"></div>
    </div>

    <div v-else-if="error" class="week-timeline__error">
      <nut-icon name="notice" size="20" color="#ff4d4f"></nut-icon>
      <span class="week-timeline__error-text">{{ error === 'TOKEN_EXPIRED' ? '登录已过期，请重新登录' : error }}</span>
    </div>

    <div v-else-if="days.length === 0" class="week-timeline__empty">
      <nut-empty description="暂无数据"></nut-empty>
    </div>

    <template v-else>
      <div class="week-timeline__days">
        <div
          v-for="day in days"
          :key="day.date"
          class="week-timeline__day"
          :class="getDayClass(day)"
        >
          <span class="week-timeline__day-name">{{ day.dayOfWeek }}</span>
          <span class="week-timeline__day-date">{{ formatShortDate(day.date) }}</span>
          <span class="week-timeline__day-status">{{ getStatusText(day) }}</span>
          <span v-if="!day.isWeekend && day.totalHours > 0" class="week-timeline__day-hours">
            {{ day.totalHours }}h
          </span>
        </div>
      </div>

      <div class="week-timeline__summary">
        <div class="week-timeline__stat">
          <span class="week-timeline__stat-value">{{ totalHours }}</span>
          <span class="week-timeline__stat-label">总工时</span>
        </div>
        <div class="week-timeline__stat">
          <span class="week-timeline__stat-value">{{ workDays }}</span>
          <span class="week-timeline__stat-label">工作日</span>
        </div>
        <div class="week-timeline__stat">
          <span class="week-timeline__stat-value">{{ averageHours }}</span>
          <span class="week-timeline__stat-label">日均工时</span>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.week-timeline {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.week-timeline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.week-timeline__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.week-timeline__loading {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.week-timeline__skeleton {
  width: calc((100% - 1.5rem) / 4);
  height: 64px;
  border-radius: 8px;
  background: #f0f0f0;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.week-timeline__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fff2f0;
  border-radius: 8px;
}

.week-timeline__error-text {
  font-size: 0.85rem;
  color: #ff4d4f;
}

.week-timeline__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.375rem;
}

.week-timeline__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.25rem;
  border-radius: 8px;
  gap: 2px;
  transition: background 0.2s;
}

.week-timeline__day--weekend {
  background: #f5f5f5;
  color: #bbb;
}

.week-timeline__day--unfilled {
  background: #fff7e6;
  color: #d48806;
}

.week-timeline__day--future {
  background: #f9f9f9;
  color: #999;
}

.week-timeline__day--filled {
  background: #f0fff4;
  color: #389e0d;
}

.week-timeline__day-name {
  font-size: 0.75rem;
  font-weight: 500;
}

.week-timeline__day-date {
  font-size: 0.7rem;
  opacity: 0.8;
}

.week-timeline__day-status {
  font-size: 0.65rem;
  font-weight: 600;
  margin-top: 2px;
}

.week-timeline__day-hours {
  font-size: 0.65rem;
  opacity: 0.7;
}

.week-timeline__summary {
  display: flex;
  justify-content: space-around;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f0f0f0;
}

.week-timeline__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.week-timeline__stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f3d3e;
}

.week-timeline__stat-label {
  font-size: 0.7rem;
  color: #999;
}

@media (max-width: 380px) {
  .week-timeline__days {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
