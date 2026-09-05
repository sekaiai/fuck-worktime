import { computed, shallowRef } from 'vue';

import { getTimingList, getTimingStatusLabel } from '../api/timesheet-client';
import type { TimingRecord } from '../types/timesheet';
import type { CalendarDayCell } from '../types/calendar';
import {
  buildMonthMatrix,
  getDateParts,
  getMonthRange,
  getTodayKey,
  isWeekendDate,
  shiftMonth,
} from '../utils/date';
import { mapDayStatus, type DayStatusKey } from '../utils/timesheet-status';

export interface UseMonthCalendarOptions {
  fetchRange: (start: string, end: string) => Promise<TimingRecord[]>;
  onError?: (message: string) => void;
}

/** 同一天多条记录时的聚合优先级：驳回最需要用户处理，通过最弱 */
const STATUS_PRIORITY: Record<string, number> = {
  审批不通过: 3,
  待审批: 2,
  审批通过: 1,
  未提交: 0,
};

function pickDayStatus(labels: string[]): string {
  return labels.reduce(
    (worst, label) => (STATUS_PRIORITY[label] ?? 0) > (STATUS_PRIORITY[worst] ?? 0) ? label : worst,
    '未提交',
  );
}

export function useMonthCalendar(options: UseMonthCalendarOptions) {
  const { fetchRange, onError } = options;

  const today = getTodayKey();
  const records = shallowRef<TimingRecord[]>([]);
  const isLoading = shallowRef(false);
  const errorMessage = shallowRef('');
  const viewYear = shallowRef(getDateParts(getTodayKey()).year);
  const viewMonth = shallowRef(getDateParts(getTodayKey()).month);

  /** 单调递增请求序号：切月过快时丢弃过期响应，避免旧月数据覆盖新月 */
  let requestSeq = 0;

  const monthLabel = computed(() => `${viewYear.value} 年 ${viewMonth.value} 月`);

  /** 按日期聚合：状态取最严重的一条，工时累加 */
  const daySummary = computed(() => {
    const map = new Map<string, { hours: number; labels: string[] }>();
    for (const record of records.value) {
      const entry = map.get(record.reportDate) ?? { hours: 0, labels: [] };
      entry.hours += Number.isFinite(record.hours) ? record.hours : 0;
      entry.labels.push(getTimingStatusLabel(record.status));
      map.set(record.reportDate, entry);
    }

    return map;
  });

  const weeks = computed<CalendarDayCell[][]>(() =>
    buildMonthMatrix(viewYear.value, viewMonth.value).map((row) =>
      row.map((cell) => {
        const isWeekend = isWeekendDate(cell.dateKey);
        const summary = daySummary.value.get(cell.dateKey);
        const statusText = summary ? pickDayStatus(summary.labels) : '未提交';
        const status = mapDayStatus({
          date: cell.dateKey,
          isWeekend,
          status: statusText,
          displayStatus: statusText,
        });

        // 未来日在日历里没有独立图例，归入「未提交」的灰点，避免多一种颜色
        const statusKey: DayStatusKey = status.key === 'future' ? 'none' : status.key;

        return {
          dateKey: cell.dateKey,
          dayOfMonth: cell.dayOfMonth,
          inCurrentMonth: cell.inCurrentMonth,
          isWeekend,
          isToday: cell.dateKey === today,
          hours: summary ? Number(summary.hours.toFixed(1)) : 0,
          statusKey,
          statusLabel: statusText,
        };
      }),
    ),
  );

  async function load(): Promise<boolean> {
    const mySeq = ++requestSeq;
    const { start, end } = getMonthRange(viewYear.value, viewMonth.value);
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const data = await fetchRange(start, end);
      if (mySeq !== requestSeq) {
        return false;
      }

      records.value = data;
      return true;
    } catch (error) {
      if (mySeq !== requestSeq) {
        return false;
      }

      const message = error instanceof Error ? error.message : '获取日历数据失败，请稍后重试。';
      errorMessage.value = message;
      onError?.(message);
      return false;
    } finally {
      if (mySeq === requestSeq) {
        isLoading.value = false;
      }
    }
  }

  function goToMonth(year: number, month: number): Promise<boolean> {
    if (year === viewYear.value && month === viewMonth.value) {
      return load();
    }

    viewYear.value = year;
    viewMonth.value = month;
    return load();
  }

  function shiftMonthBy(offset: number): Promise<boolean> {
    const next = shiftMonth(viewYear.value, viewMonth.value, offset);
    return goToMonth(next.year, next.month);
  }

  /** 跳转到指定日期所在月份；返回是否真的切了月（未切月时调用方按同周处理） */
  function revealDate(dateKey: string): Promise<boolean> {
    const { year, month } = getDateParts(dateKey);
    if (year === viewYear.value && month === viewMonth.value) {
      return Promise.resolve(false);
    }

    return goToMonth(year, month).then(() => true);
  }

  return {
    records,
    isLoading,
    errorMessage,
    viewYear,
    viewMonth,
    monthLabel,
    weeks,
    load,
    goToMonth,
    shiftMonthBy,
    revealDate,
  };
}
