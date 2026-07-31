// 内联实现：避免 Node ESM（type stripping，需显式 .ts 扩展名）与 Vite bundler
// （moduleResolution: bundler，禁止 .ts 扩展名）的导入方式冲突。
function getTodayKey(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export type DayStatusKey = 'rest' | 'none' | 'pending' | 'approved' | 'rejected' | 'future';

export interface DayStatusInput {
  date: string;
  isWeekend: boolean;
  status: string;
  displayStatus: string;
}

export interface DayStatusResult {
  key: DayStatusKey;
  label: string;
  color: string;
}

const STATUS_COLORS: Record<Exclude<DayStatusKey, 'future'>, string> = {
  rest: '#cbd5e1',
  none: '#64748b',
  pending: '#346ef5',
  approved: '#1f9d63',
  rejected: '#dc4c42',
};

export function mapDayStatus(day: DayStatusInput): DayStatusResult {
  if (day.isWeekend) {
    return { key: 'rest', label: '休息日', color: STATUS_COLORS.rest };
  }

  const text = `${day.status} ${day.displayStatus}`;
  if (text.includes('待审核')) {
    return { key: 'pending', label: '待审核', color: STATUS_COLORS.pending };
  }
  if (/不通过|失败|驳回/.test(text)) {
    return { key: 'rejected', label: '审核失败', color: STATUS_COLORS.rejected };
  }
  if (/通过|已审核|已完成/.test(text)) {
    return { key: 'approved', label: '已审核', color: STATUS_COLORS.approved };
  }
  if (day.status === '未提交' && day.date > getTodayKey()) {
    return { key: 'future', label: '未来日', color: 'transparent' };
  }
  return { key: 'none', label: '未填报', color: STATUS_COLORS.none };
}
