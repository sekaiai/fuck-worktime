import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { getWeekBoard } from '../api/timesheet-client';
import type { WeekBoardResponse, WeekDay } from '../types/timesheet';
import { formatWeekRange, getTodayKey, getWeekStart } from '../utils/date';

export function useWeekBoardData() {
  const board = shallowRef<WeekBoardResponse | null>(null);
  const isLoading = shallowRef(false);
  const errorMessage = shallowRef('');
  const errorCode = shallowRef('');
  const currentDate = shallowRef(getWeekStart());

  const days = computed(() => board.value?.days ?? []);
  const fillableDays = computed(() =>
    days.value.filter(
      (day) => !day.isWeekend && day.status === '未提交' && day.date <= getTodayKey(),
    ),
  );
  const totalHours = computed(() => board.value?.totalHours ?? 0);
  const workDays = computed(() => days.value.filter((day) => !day.isWeekend).length);
  const averageHours = computed(() => {
    if (workDays.value === 0) {
      return 0;
    }

    return Number((totalHours.value / workDays.value).toFixed(1));
  });
  const weekTitle = computed(() => board.value?.currentWeek || '本周填报状态');
  const weekRange = computed(() => formatWeekRange(days.value.map((day) => day.date)));

  async function loadWeek(date = currentDate.value): Promise<boolean> {
    currentDate.value = date;
    isLoading.value = true;
    errorMessage.value = '';
    errorCode.value = '';

    try {
      board.value = await getWeekBoard(date);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        errorMessage.value = error.message;
        errorCode.value = error.code ?? '';
      } else {
        errorMessage.value = '获取本周填报状态失败，请稍后重试。';
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    board,
    days,
    fillableDays,
    totalHours,
    workDays,
    averageHours,
    weekTitle,
    weekRange,
    isLoading,
    errorMessage,
    errorCode,
    currentDate,
    loadWeek,
  };
}
