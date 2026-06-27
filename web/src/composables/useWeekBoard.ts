import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { getWeekBoard } from '../api/timesheet-client';
import type { WeekBoardResponse, WeekDay } from '../types/timesheet';
import { formatWeekRange, getTodayKey, getWeekStart, shiftDateKeyByDays } from '../utils/date';

export function useWeekBoard() {
  const board = shallowRef<WeekBoardResponse | null>(null);
  const isWeekLoading = shallowRef(false);
  const errorMessage = shallowRef('');
  const errorCode = shallowRef('');
  const currentDate = shallowRef(getWeekStart());
  const selectedDayDate = shallowRef('');

  /**
   * 单调递增的请求序号。loadWeek 每次发起请求前自增，响应回来后比对：
   * 若不是最新一次请求，则丢弃响应，避免快速切换"上一周/下一周"时先发后到覆盖最新周。
   */
  let requestSeq = 0;

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
  const weekStartOfToday = computed(() => getWeekStart());
  const isCurrentWeek = computed(() => currentDate.value === weekStartOfToday.value);
  const selectedDay = computed(() => days.value.find((day) => day.date === selectedDayDate.value) ?? null);

  function syncSelectedBoardDay(): void {
    const stillExists = days.value.some((day) => day.date === selectedDayDate.value);
    if (stillExists) {
      return;
    }

    const firstFilledDay = days.value.find((day) => canInspectDay(day));
    selectedDayDate.value = firstFilledDay?.date ?? '';
  }

  async function loadWeek(date = currentDate.value): Promise<boolean> {
    const mySeq = ++requestSeq;
    currentDate.value = getWeekStart(date);
    isWeekLoading.value = true;
    errorMessage.value = '';
    errorCode.value = '';

    try {
      const result = await getWeekBoard(currentDate.value);
      if (mySeq !== requestSeq) {
        // 已被更新的请求取代，丢弃响应
        return false;
      }
      board.value = result;
      syncSelectedBoardDay();
      return true;
    } catch (error) {
      if (mySeq !== requestSeq) {
        return false;
      }
      if (error instanceof ApiError) {
        errorMessage.value = error.message;
        errorCode.value = error.code ?? '';
      } else {
        errorMessage.value = '获取填报状态失败，请稍后重试。';
      }
      return false;
    } finally {
      if (mySeq === requestSeq) {
        isWeekLoading.value = false;
      }
    }
  }

  async function switchWeek(direction: 'previous' | 'current' | 'next'): Promise<void> {
    const actions: Record<typeof direction, () => Promise<boolean>> = {
      previous: () => loadWeek(shiftDateKeyByDays(currentDate.value, -7)),
      current: () => (isCurrentWeek.value ? Promise.resolve(true) : loadWeek(weekStartOfToday.value)),
      next: () => loadWeek(shiftDateKeyByDays(currentDate.value, 7)),
    };
    await actions[direction]();
  }

  function selectBoardDay(day: WeekDay): void {
    if (!canInspectDay(day)) {
      return;
    }

    if (selectedDayDate.value === day.date) {
      selectedDayDate.value = '';
      return;
    }

    selectedDayDate.value = day.date;
  }

  function canInspectDay(day: WeekDay): boolean {
    return !day.isWeekend && day.details.length > 0 && day.status !== '未提交';
  }

  return {
    board,
    isWeekLoading,
    errorMessage,
    errorCode,
    currentDate,
    selectedDayDate,
    days,
    fillableDays,
    totalHours,
    workDays,
    averageHours,
    weekTitle,
    weekRange,
    isCurrentWeek,
    selectedDay,
    loadWeek,
    switchWeek,
    selectBoardDay,
    canInspectDay,
  };
}
