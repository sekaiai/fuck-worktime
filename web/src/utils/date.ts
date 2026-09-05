export function formatDateKey(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export function getWeekStart(date: Date | string = new Date()): string {
  const target = typeof date === 'string' ? new Date(`${date}T00:00:00`) : new Date(date);
  const day = target.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  target.setDate(target.getDate() + diff);
  return formatDateKey(target);
}

export function shiftDateKeyByDays(dateKey: string, days: number): string {
  const target = new Date(`${dateKey}T00:00:00`);
  target.setDate(target.getDate() + days);
  return formatDateKey(target);
}

export function formatDisplayDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatWeekRange(days: string[]): string {
  if (days.length === 0) {
    return '';
  }

  const sorted = [...days].sort();
  return `${formatDisplayDate(sorted[0])} - ${formatDisplayDate(sorted[sorted.length - 1])}`;
}

/** yyyy-MM-dd → MM-DD，用于紧凑的行内展示 */
export function formatShortDateKey(dateKey: string): string {
  return dateKey.slice(5);
}

export function getWeekdayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[date.getDay()] ?? '';
}

export function isWeekendDate(dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function getDateParts(dateKey: string): DateParts {
  const [year, month, day] = dateKey.split('-');
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

/** 月视图网格的单元格：含补位的上月/下月日期，inCurrentMonth 用于置灰 */
export interface MonthCell {
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
}

/** 固定 6 行 × 7 列的月视图网格，周一起始，避免切月时高度跳动 */
export function buildMonthMatrix(year: number, month: number): MonthCell[][] {
  const firstDay = new Date(year, month - 1, 1);
  // getDay(): 0=周日 → 周一为 0，故 (day + 6) % 7
  const leadingCount = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - leadingCount);

  const weeks: MonthCell[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const row: MonthCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const cursor = new Date(gridStart);
      cursor.setDate(gridStart.getDate() + week * 7 + day);
      const dateKey = formatDateKey(cursor);
      row.push({
        dateKey,
        dayOfMonth: cursor.getDate(),
        inCurrentMonth: cursor.getMonth() === month - 1 && cursor.getFullYear() === year,
      });
    }
    weeks.push(row);
  }

  return weeks;
}

/** 月视图请求区间：覆盖网格补位日期，保证跨月周的状态点也正确 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const matrix = buildMonthMatrix(year, month);
  const first = matrix[0]?.[0];
  const last = matrix[matrix.length - 1]?.[6];

  return {
    start: first?.dateKey ?? `${year}-${String(month).padStart(2, '0')}-01`,
    end: last?.dateKey ?? `${year}-${String(month).padStart(2, '0')}-01`,
  };
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year} 年 ${month} 月`;
}

export function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const target = new Date(year, month - 1 + offset, 1);
  return { year: target.getFullYear(), month: target.getMonth() + 1 };
}
