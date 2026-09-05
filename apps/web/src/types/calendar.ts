import type { DayStatusKey } from '../utils/timesheet-status';

/** 月视图单元格：网格补位信息 + 当日聚合状态，供日历组件直接渲染 */
export interface CalendarDayCell {
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  /** 当日填报总工时，含所有状态的记录 */
  hours: number;
  statusKey: DayStatusKey;
  statusLabel: string;
}
