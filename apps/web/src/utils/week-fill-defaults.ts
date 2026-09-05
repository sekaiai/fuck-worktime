import type { AutoFillConfig } from '../types/auto-fill';
import type { WeekFillDefaults, WeekFillDraftRow, WeekFillRowError } from '../types/week-fill';
import { getLocalStorage, setLocalStorage } from './cache';

const LAST_USED_KEY = 'week_fill_last_used';

export const EMPTY_DEFAULTS: WeekFillDefaults = {
  projectId: '',
  projectTitle: '',
  projectStatus: 30,
  itemId: '',
  itemName: '',
  hours: 8,
  work: '',
};

/**
 * 读取上次手动填报使用的默认值。
 * 解析失败或结构不符时返回 null，由调用方回落到下一优先级。
 */
export function readLastUsedDefaults(): WeekFillDefaults | null {
  const raw = getLocalStorage(LAST_USED_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.projectId !== 'string' || !record.projectId) {
      return null;
    }

    return {
      projectId: record.projectId,
      projectTitle: typeof record.projectTitle === 'string' ? record.projectTitle : '',
      projectStatus: typeof record.projectStatus === 'number' ? record.projectStatus : 30,
      itemId: typeof record.itemId === 'string' ? record.itemId : '',
      itemName: typeof record.itemName === 'string' ? record.itemName : '',
      hours: typeof record.hours === 'number' && record.hours > 0 ? record.hours : 8,
      work: typeof record.work === 'string' ? record.work : '',
    };
  } catch {
    return null;
  }
}

export function writeLastUsedDefaults(defaults: WeekFillDefaults): void {
  try {
    setLocalStorage(LAST_USED_KEY, JSON.stringify(defaults));
  } catch {
    // 隐私模式下 localStorage 写入会抛错，忽略即可，不影响填报
  }
}

/**
 * spec §8 的默认值优先级：localStorage > AutoFillConfig > 空。
 * 逐字段回落而非整体二选一——上次用过项目但没存工时，工时仍能取自动填报配置。
 */
export function resolveDefaults(
  lastUsed: WeekFillDefaults | null,
  autoFillConfig: AutoFillConfig | null,
): WeekFillDefaults {
  const fromConfig: WeekFillDefaults | null = autoFillConfig
    ? {
        projectId: autoFillConfig.projectId,
        projectTitle: autoFillConfig.projectTitle,
        projectStatus: autoFillConfig.projectStatus,
        itemId: autoFillConfig.itemId,
        itemName: autoFillConfig.itemName,
        hours: autoFillConfig.hours,
        work: autoFillConfig.work,
      }
    : null;

  const pickString = (...values: (string | undefined)[]): string =>
    values.find((value) => typeof value === 'string' && value !== '') ?? '';

  const pickHours = (...values: (number | undefined)[]): number =>
    values.find((value) => typeof value === 'number' && value > 0) ?? 8;

  return {
    projectId: pickString(lastUsed?.projectId, fromConfig?.projectId),
    projectTitle: pickString(lastUsed?.projectTitle, fromConfig?.projectTitle),
    projectStatus: lastUsed?.projectStatus ?? fromConfig?.projectStatus ?? 30,
    itemId: pickString(lastUsed?.itemId, fromConfig?.itemId),
    itemName: pickString(lastUsed?.itemName, fromConfig?.itemName),
    hours: pickHours(lastUsed?.hours, fromConfig?.hours),
    work: pickString(lastUsed?.work, fromConfig?.work),
  };
}

/**
 * spec §10 的硬错误校验。刻意不校验每天总工时上下限。
 * 返回 null 表示该行可提交。
 */
export function validateRow(row: WeekFillDraftRow): WeekFillRowError | null {
  const fail = (message: string): WeekFillRowError => ({
    rowId: row.rowId,
    reportDate: row.reportDate,
    message,
  });

  if (!row.projectId) {
    return fail('未选择项目');
  }
  if (!row.itemId) {
    return fail('未选择工时类型');
  }
  if (!row.content.trim()) {
    return fail('工作内容为空');
  }
  if (!Number.isFinite(row.hours) || row.hours <= 0) {
    return fail('工时必须大于 0');
  }

  return null;
}

export function validateRows(rows: WeekFillDraftRow[]): WeekFillRowError[] {
  return rows.map(validateRow).filter((error): error is WeekFillRowError => error !== null);
}
