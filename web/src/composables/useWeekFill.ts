import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { buildBatchPayload, generateContent, submitBatch, updateEntry } from '../api/timesheet-client';
import type { AutoFillConfig } from '../types/auto-fill';
import type { Project, TimesheetEntry, WeekDay, WorkTypeNode } from '../types/timesheet';
import type { WeekFillDefaults, WeekFillDraftRow, WeekFillRowError } from '../types/week-fill';
import { mapDayStatus } from '../utils/timesheet-status';
import {
  EMPTY_DEFAULTS,
  readLastUsedDefaults,
  resolveDefaults,
  validateRows,
  writeLastUsedDefaults,
} from '../utils/week-fill-defaults';

export interface UseWeekFillOptions {
  days: () => WeekDay[];
  projects: () => Project[];
  getWorkTypesForProject: (projectId: string) => WorkTypeNode[];
  loadWorkTypesByProject: (projectId: string) => Promise<WorkTypeNode[]>;
  getAutoFillConfig: () => AutoFillConfig | null;
  refreshWeekBoard: () => Promise<void>;
  showToast: (msg: string) => void;
}

let rowSeq = 0;

function createRowId(): string {
  rowSeq += 1;
  return `row_${Date.now()}_${rowSeq}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function useWeekFill(options: UseWeekFillOptions) {
  const {
    days,
    projects,
    getWorkTypesForProject,
    loadWorkTypesByProject,
    getAutoFillConfig,
    refreshWeekBoard,
    showToast,
  } = options;

  const draftRows = shallowRef<WeekFillDraftRow[]>([]);
  const defaults = shallowRef<WeekFillDefaults>(EMPTY_DEFAULTS);
  const weekTheme = shallowRef('');
  const isGenerating = shallowRef(false);
  const isSubmitting = shallowRef(false);
  const expandedDates = shallowRef<string[]>([]);

  /** 一周七天按 spec §6 的四种形态分类，供视图直接消费 */
  const dayForms = computed(() =>
    days().map((day) => {
      const status = mapDayStatus(day);
      const form: 'editable' | 'readonly' | 'future' | 'rest' =
        status.key === 'rest'
          ? 'rest'
          : status.key === 'future'
            ? 'future'
            : status.key === 'none' || status.key === 'rejected'
              ? 'editable'
              : 'readonly';

      return { day, status, form };
    }),
  );

  /** 可填报的日期（未填 + 审核失败），AI 生成与新增行的目标范围 */
  const editableDates = computed(() =>
    dayForms.value.filter((item) => item.form === 'editable').map((item) => item.day.date),
  );

  const rowsByDate = computed(() => {
    const map: Record<string, WeekFillDraftRow[]> = {};
    for (const row of draftRows.value) {
      (map[row.reportDate] ??= []).push(row);
    }

    return map;
  });

  const rowErrors = computed<WeekFillRowError[]>(() => validateRows(draftRows.value));

  const pendingCount = computed(() => draftRows.value.length);

  const pendingHours = computed(() =>
    draftRows.value.reduce((sum, row) => sum + (Number.isFinite(row.hours) ? row.hours : 0), 0),
  );

  const canSubmit = computed(
    () => draftRows.value.length > 0 && rowErrors.value.length === 0 && !isSubmitting.value,
  );

  function buildRow(reportDate: string, patch: Partial<WeekFillDraftRow> = {}): WeekFillDraftRow {
    const base = defaults.value;
    return {
      rowId: createRowId(),
      reportDate,
      sourceId: null,
      projectId: base.projectId,
      projectTitle: base.projectTitle,
      projectStatus: base.projectStatus,
      itemId: base.itemId,
      itemName: base.itemName,
      hours: base.hours,
      content: '',
      ...patch,
    };
  }

  function addRow(reportDate: string): void {
    draftRows.value = [...draftRows.value, buildRow(reportDate)];
    if (!expandedDates.value.includes(reportDate)) {
      expandedDates.value = [...expandedDates.value, reportDate];
    }
  }

  function duplicateRow(rowId: string): void {
    const index = draftRows.value.findIndex((row) => row.rowId === rowId);
    if (index === -1) {
      return;
    }

    const source = draftRows.value[index];
    // 复制出的行是全新记录，必须清掉 sourceId，否则提交时会去更新原记录
    const copy: WeekFillDraftRow = { ...source, rowId: createRowId(), sourceId: null };
    const next = [...draftRows.value];
    next.splice(index + 1, 0, copy);
    draftRows.value = next;
  }

  function removeRow(rowId: string): void {
    draftRows.value = draftRows.value.filter((row) => row.rowId !== rowId);
  }

  function patchRow(rowId: string, patch: Partial<WeekFillDraftRow>): void {
    draftRows.value = draftRows.value.map((row) =>
      row.rowId === rowId ? { ...row, ...patch } : row,
    );
  }

  /**
   * 改项目时必须清空该行工时类型并重新加载选项（spec §7 的联动要求）。
   * 类型列表由 useProjectCatalog 缓存，重复调用不会重复请求。
   */
  async function setRowProject(rowId: string, projectId: string): Promise<void> {
    const project = projects().find((item) => item.id === projectId);
    patchRow(rowId, {
      projectId,
      projectTitle: project?.title ?? '',
      projectStatus: project?.projectStatus ?? 30,
      itemId: '',
      itemName: '',
    });

    if (!projectId) {
      return;
    }

    try {
      await loadWorkTypesByProject(projectId);
    } catch (error) {
      showToast(getErrorMessage(error, '获取工时类型失败。'));
    }
  }

  function setRowWorkType(rowId: string, itemId: string): void {
    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row) {
      return;
    }

    const workTypes = getWorkTypesForProject(row.projectId);
    const flat = workTypes.flatMap((node) => (node.children?.length ? node.children : [node]));
    const target = flat.find((node) => node.id === itemId);
    patchRow(rowId, { itemId, itemName: target?.name ?? '' });
  }

  function setRowHours(rowId: string, hours: number): void {
    patchRow(rowId, { hours });
  }

  function setRowContent(rowId: string, content: string): void {
    patchRow(rowId, { content });
  }

  /**
   * 页面加载或切周后调用。
   * 1) 解析默认值（localStorage > AutoFillConfig > 空）
   * 2) 校正非法的「项目 A + 项目 B 的类型」组合
   * 3) 为审核失败的天预填原记录，未填的天不预建行
   */
  async function initializeWeek(): Promise<void> {
    const resolved = resolveDefaults(readLastUsedDefaults(), getAutoFillConfig());
    defaults.value = resolved;
    weekTheme.value = resolved.work;

    if (resolved.projectId && resolved.itemId) {
      try {
        const workTypes = await loadWorkTypesByProject(resolved.projectId);
        const flat = workTypes.flatMap((node) => (node.children?.length ? node.children : [node]));
        if (!flat.some((node) => node.id === resolved.itemId)) {
          defaults.value = { ...resolved, itemId: '', itemName: '' };
        }
      } catch {
        // 加载失败不阻断页面，用户仍可手动选择
      }
    }

    const rejectedRows: WeekFillDraftRow[] = [];
    for (const item of dayForms.value) {
      if (item.status.key !== 'rejected') {
        continue;
      }

      for (const detail of item.day.details) {
        rejectedRows.push(
          buildRow(item.day.date, {
            sourceId: detail.id || null,
            content: detail.content,
            hours: detail.hours > 0 ? detail.hours : defaults.value.hours,
            projectId: detail.projectId ?? defaults.value.projectId,
            itemId: detail.projectId && detail.itemId ? detail.itemId : defaults.value.itemId,
          }),
        );
      }
    }

    draftRows.value = rejectedRows;
    expandedDates.value = editableDates.value;
  }

  /**
   * spec §9：为指定日期批量生成内容。
   * 关键行为——已有内容的行不覆盖，只填空行与新建行。
   */
  async function generateForDates(dates: string[]): Promise<void> {
    if (dates.length === 0) {
      showToast('本周没有需要填报的日期。');
      return;
    }
    if (!defaults.value.projectId || !defaults.value.itemId) {
      showToast('请先选择默认项目和工时类型。');
      return;
    }
    if (!weekTheme.value.trim()) {
      showToast('请先填写本周主题。');
      return;
    }

    isGenerating.value = true;
    try {
      const contents = await generateContent(weekTheme.value.trim(), dates.length);
      if (contents.length < dates.length) {
        showToast('AI 暂时未生成足够内容，请稍后重试。');
        return;
      }

      const next = [...draftRows.value];
      for (const [index, date] of dates.entries()) {
        const content = contents[index];
        if (!content) {
          continue;
        }

        const blankIndex = next.findIndex(
          (row) => row.reportDate === date && !row.content.trim(),
        );

        if (blankIndex === -1) {
          const hasAnyRow = next.some((row) => row.reportDate === date);
          // 该日期已有行且都填了内容 → 跳过，不覆盖用户已写的内容
          if (hasAnyRow) {
            continue;
          }

          next.push(buildRow(date, { content }));
        } else {
          next[blankIndex] = { ...next[blankIndex], content };
        }
      }

      draftRows.value = next;
      expandedDates.value = [...new Set([...expandedDates.value, ...dates])];
    } catch (error) {
      showToast(getErrorMessage(error, '生成工时失败。'));
    } finally {
      isGenerating.value = false;
    }
  }

  /** 行内 ✨：只重新生成这一行，允许覆盖本行已有内容（用户主动触发） */
  async function regenerateRow(rowId: string): Promise<void> {
    if (!weekTheme.value.trim()) {
      showToast('请先填写本周主题。');
      return;
    }

    isGenerating.value = true;
    try {
      const contents = await generateContent(weekTheme.value.trim(), 1);
      const content = contents[0];
      if (!content) {
        showToast('AI 暂时未生成内容，请稍后重试。');
        return;
      }

      patchRow(rowId, { content });
    } catch (error) {
      showToast(getErrorMessage(error, '生成工时失败。'));
    } finally {
      isGenerating.value = false;
    }
  }

  async function setDefaultProject(projectId: string): Promise<void> {
    const project = projects().find((item) => item.id === projectId);
    defaults.value = {
      ...defaults.value,
      projectId,
      projectTitle: project?.title ?? '',
      projectStatus: project?.projectStatus ?? 30,
      itemId: '',
      itemName: '',
    };

    if (!projectId) {
      return;
    }

    try {
      await loadWorkTypesByProject(projectId);
    } catch (error) {
      showToast(getErrorMessage(error, '获取工时类型失败。'));
    }
  }

  function setDefaultWorkType(itemId: string): void {
    const workTypes = getWorkTypesForProject(defaults.value.projectId);
    const flat = workTypes.flatMap((node) => (node.children?.length ? node.children : [node]));
    const target = flat.find((node) => node.id === itemId);
    defaults.value = { ...defaults.value, itemId, itemName: target?.name ?? '' };
  }

  function setDefaultHours(hours: number): void {
    defaults.value = { ...defaults.value, hours };
  }

  function setWeekTheme(value: string): void {
    weekTheme.value = value;
  }

  function toggleDate(date: string): void {
    expandedDates.value = expandedDates.value.includes(date)
      ? expandedDates.value.filter((item) => item !== date)
      : [...expandedDates.value, date];
  }

  function toEntry(row: WeekFillDraftRow): TimesheetEntry {
    return {
      reportDate: row.reportDate,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      projectStatus: row.projectStatus,
      itemId: row.itemId,
      itemName: row.itemName,
      content: row.content.trim(),
      hours: row.hours,
    };
  }

  /**
   * spec §10：只做批量提交。
   * 新建行走 submitBatch；带 sourceId 的行（审核失败重填）逐条走 updateEntry。
   */
  async function submitAll(): Promise<void> {
    if (draftRows.value.length === 0) {
      showToast('没有待提交的内容。');
      return;
    }

    const errors = rowErrors.value;
    if (errors.length > 0) {
      showToast(`${errors[0].reportDate} ${errors[0].message}`);
      return;
    }

    isSubmitting.value = true;
    try {
      const creates = draftRows.value.filter((row) => !row.sourceId);
      const updates = draftRows.value.filter((row) => row.sourceId);

      if (creates.length > 0) {
        const result = await submitBatch(buildBatchPayload(creates.map(toEntry)));
        if (result.code !== 200) {
          showToast(result.msg);
          return;
        }
      }

      for (const row of updates) {
        const result = await updateEntry(row.sourceId as string, toEntry(row));
        if (result.code !== 200) {
          showToast(`${row.reportDate} ${result.msg}`);
          return;
        }
      }

      writeLastUsedDefaults({ ...defaults.value, work: weekTheme.value });
      draftRows.value = [];
      showToast('提交成功。');
      await refreshWeekBoard();
      await initializeWeek();
    } catch (error) {
      showToast(getErrorMessage(error, '提交工时失败。'));
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    draftRows,
    defaults,
    weekTheme,
    isGenerating,
    isSubmitting,
    expandedDates,
    dayForms,
    editableDates,
    rowsByDate,
    rowErrors,
    pendingCount,
    pendingHours,
    canSubmit,
    initializeWeek,
    addRow,
    duplicateRow,
    removeRow,
    setRowProject,
    setRowWorkType,
    setRowHours,
    setRowContent,
    generateForDates,
    regenerateRow,
    setDefaultProject,
    setDefaultWorkType,
    setDefaultHours,
    setWeekTheme,
    toggleDate,
    submitAll,
  };
}
