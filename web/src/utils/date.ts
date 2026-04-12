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
