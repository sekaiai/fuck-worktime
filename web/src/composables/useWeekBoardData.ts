import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { getWeekBoard } from '../api/timesheet-client';
import type { WeekBoardResponse } from '../types/timesheet';
import { formatWeekRange, getTodayKey, getWeekStart, shiftDateKeyByDays } from '../utils/date';

export function useWeekBoardData() {
  const board = shallowRef<WeekBoardResponse | null>(null);
  const isLoading = shallowRef(false);
  const errorMessage = shallowRef('');
  const errorCode = shallowRef('');
  const currentDate = shallowRef(getWeekStart());

  const days = computed(() => board.value?.days ?? []);
  const fillableDays = computed(() =>
    days.value.filter((day) => !day.isWeekend && day.status === '未提交' && day.date <= getTodayKey()),
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
  const canGoNextWeek = computed(() => currentDate.value < getWeekStart());

  async function loadWeek(date = currentDate.value): Promise<boolean> {
    currentDate.value = getWeekStart(date);
    isLoading.value = true;
    errorMessage.value = '';
    errorCode.value = '';

    try {
      board.value = await getWeekBoard(currentDate.value);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        errorMessage.value = error.message;
        errorCode.value = error.code ?? '';
      } else {
        errorMessage.value = '获取填报状态失败，请稍后重试。';
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function goToPreviousWeek(): Promise<boolean> {
    return loadWeek(shiftDateKeyByDays(currentDate.value, -7));
  }

  async function goToNextWeek(): Promise<boolean> {
    if (!canGoNextWeek.value) {
      return false;
    }

    return loadWeek(shiftDateKeyByDays(currentDate.value, 7));
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
    canGoNextWeek,
    loadWeek,
    goToPreviousWeek,
    goToNextWeek,
  };
}
