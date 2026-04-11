import { ref, computed } from 'vue';
import { getWeekBoard } from '../api/timesheet';
import type { WeekDay, WeekBoardResponse } from '../types/timesheet';

export function useWeeklyReport() {
  const report = ref<WeekBoardResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentDate = ref(new Date().toISOString().split('T')[0]);

  const days = computed(() => report.value?.days || []);

  const fillableDays = computed(() =>
    days.value.filter(
      (d: WeekDay) => !d.isWeekend && d.status === '未提交' && d.date <= new Date().toISOString().split('T')[0],
    ),
  );

  const unfilledCount = computed(() => fillableDays.value.length);

  const totalHours = computed(() => report.value?.totalHours || 0);

  const workDays = computed(() =>
    days.value.filter((d: WeekDay) => !d.isWeekend).length,
  );

  const averageHours = computed(() => {
    const wd = workDays.value;
    return wd > 0 ? Math.round((totalHours.value / wd) * 10) / 10 : 0;
  });

  async function loadWeek(date?: string): Promise<void> {
    const queryDate = date || currentDate.value;
    currentDate.value = queryDate;
    isLoading.value = true;
    error.value = null;

    try {
      report.value = await getWeekBoard(queryDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取周报数据失败';
      if (message === 'TOKEN_EXPIRED') {
        error.value = 'TOKEN_EXPIRED';
      } else {
        error.value = message;
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    await loadWeek(currentDate.value);
  }

  function getWeekDates(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset * 7);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return monday.toISOString().split('T')[0];
  }

  return {
    report,
    days,
    fillableDays,
    unfilledCount,
    totalHours,
    workDays,
    averageHours,
    isLoading,
    error,
    currentDate,
    loadWeek,
    refresh,
    getWeekDates,
  };
}
