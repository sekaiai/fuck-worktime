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

/**
 * 只有审批中/审批完成的明细锁定输入；驳回、撤回等明确可编辑状态优先级更高。
 * dayStatusKey 只作为明细没有状态文案时的兜底，避免聚合状态误锁定驳回明细。
 */
export function isReadonlyTimesheetStatus(
  status: string,
  statusDesc: string,
  dayStatusKey?: DayStatusKey,
): boolean {
  const text = `${status} ${statusDesc}`;
  if (/不通过|未通过|失败|驳回|撤回|未提交/.test(text)) {
    return false;
  }
  if (/待审核|待审批|通过|已审核|已完成/.test(text)) {
    return true;
  }
  return dayStatusKey === 'pending' || dayStatusKey === 'approved';
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
  const displayLabel = day.displayStatus;
  if (/待审核|待审批/.test(text)) {
    return { key: 'pending', label: displayLabel || day.status || '待审批', color: STATUS_COLORS.pending };
  }
  if (/不通过|未通过|失败|驳回/.test(text)) {
    return { key: 'rejected', label: displayLabel || day.status || '审核失败', color: STATUS_COLORS.rejected };
  }
  if (/通过|已审核|已完成/.test(text)) {
    return { key: 'approved', label: displayLabel || day.status || '已审核', color: STATUS_COLORS.approved };
  }
  if (day.status === '未提交' && day.date > getTodayKey()) {
    return { key: 'future', label: '未来日', color: 'transparent' };
  }
  return { key: 'none', label: '未填报', color: STATUS_COLORS.none };
}
