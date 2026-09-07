import { computed, shallowRef } from 'vue';

import { ApiError, getErrorMessage } from '../api/request';
import {
  buildBatchPayload,
  deleteEntry,
  generateContent,
  generateContentFromLastWeek,
  getReportFlowButtons,
  getReportFlowTask,
  handleReportFlow,
  isReportSuccessCode,
  revokeEntry,
  submitBatch,
} from '../api/timesheet-client';
import type { AutoFillConfig } from '../types/auto-fill';
import type {
  Project,
  PreviousWeekContent,
  ReportActionResponse,
  TimesheetEntry,
  WeekDay,
  WorkTypeNode,
} from '../types/timesheet';
import type {
  WeekFillDefaults,
  WeekFillDraftRow,
  WeekFillRowError,
  WeekFillSubmitItem,
  WeekFillSubmitResult,
  WeekFillSubmitStep,
  WeekFillSubmitStepName,
} from '../types/week-fill';
import { getWeekdayLabel } from '../utils/date';
import { isReadonlyTimesheetStatus, mapDayStatus } from '../utils/timesheet-status';
import { calculateRemainingHours } from '../utils/week-fill-hours';
import {
  EMPTY_DEFAULTS,
  readLastUsedDefaults,
  resolveDefaults,
  validateRows,
  writeLastUsedDefaults,
} from '../utils/week-fill-defaults';
import { flattenWorkTypes } from '../utils/work-types';
import type { ToastType } from './useToast';

export interface UseWeekFillOptions {
  days: () => WeekDay[];
  projects: () => Project[];
  getWorkTypesForProject: (projectId: string) => WorkTypeNode[];
  loadWorkTypesByProject: (projectId: string) => Promise<WorkTypeNode[]>;
  getAutoFillConfig: () => AutoFillConfig | null;
  refreshWeekBoard: () => Promise<void>;
  showToast: (msg: string, type?: ToastType) => void;
}

let rowSeq = 0;
const SUBMIT_REFRESH_DELAY_MS = 2000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createRowId(): string {
  rowSeq += 1;
  return `row_${Date.now()}_${rowSeq}`;
}

/** 把提交链路异常转成用户可读的失败原因，展示层绝不出现原始 JSON 或技术信息 */
function formatSubmitFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'TIMEOUT') {
      return '请求超时，请稍后重试';
    }
    if (error.status === undefined && error.code === undefined) {
      return '网络异常，请检查网络';
    }
    return error.message.trim() || fallback;
  }

  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function toSubmitStep(
  name: WeekFillSubmitStepName,
  response: ReportActionResponse,
): WeekFillSubmitStep {
  return {
    name,
    code: response.code,
    msg: response.msg,
    data: response.data,
  };
}

function toErrorStep(
  name: WeekFillSubmitStepName,
  error: unknown,
  fallback: string,
): WeekFillSubmitStep {
  return {
    name,
    code: error instanceof ApiError && typeof error.status === 'number' ? error.status : -1,
    msg: getErrorMessage(error, fallback),
    data: null,
  };
}

function lastStep(item: WeekFillSubmitItem): WeekFillSubmitStep | null {
  return item.steps[item.steps.length - 1] ?? null;
}

function itemMessage(item: WeekFillSubmitItem): string {
  return item.errorMessage || lastStep(item)?.msg || (item.success ? '提交成功' : '提交失败');
}

function createSubmitItem(
  row: WeekFillDraftRow,
  mode: WeekFillSubmitItem['mode'],
): WeekFillSubmitItem {
  return {
    rowId: row.rowId,
    reportDate: row.reportDate,
    mode,
    success: false,
    steps: [],
  };
}

function buildSubmitResult(items: WeekFillSubmitItem[]): WeekFillSubmitResult {
  // 展示层只读 errorMessage：失败但缺少可读原因时，用最后一步的上游 msg 兜底
  for (const item of items) {
    if (!item.success && !item.errorMessage) {
      item.errorMessage = lastStep(item)?.msg || '提交失败，请稍后重试';
    }
  }

  const failedItem = items.find((item) => !item.success);
  const representativeItem = failedItem ?? items[items.length - 1];
  const representativeStep = representativeItem ? lastStep(representativeItem) : null;
  const msg = items.length === 1
    ? representativeItem ? itemMessage(representativeItem) : '提交完成'
    : items
      .map((item) => `${item.reportDate}：${itemMessage(item)}`)
      .join('；');

  return {
    code: representativeItem?.errorMessage ? -1 : representativeStep?.code ?? -1,
    msg,
    data: items.length === 1 ? representativeStep?.data ?? null : null,
    items,
  };
}

/** 面向用户的提交结果摘要：全部成功 / 部分失败 / 全部失败 三档 */
function buildSubmitSummary(result: WeekFillSubmitResult): { message: string; type: ToastType } {
  const total = result.items.length;
  const successCount = result.items.filter((item) => item.success).length;
  const failCount = total - successCount;

  if (failCount === 0) {
    return { message: `提交完成：${total} 条已提交`, type: 'success' };
  }
  if (successCount === 0) {
    return { message: `提交失败：${total} 条未成功`, type: 'error' };
  }
  return { message: `提交完成：成功 ${successCount} 条，失败 ${failCount} 条`, type: 'error' };
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
  const submitResult = shallowRef<WeekFillSubmitResult | null>(null);
  const submittingRowIds = shallowRef<string[]>([]);
  const deletingRowIds = shallowRef<string[]>([]);
  const revokingDetailIds = shallowRef<string[]>([]);
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

  /** 有剩余工时的工作日，AI 生成与新增行都可以使用这些日期 */
  const editableDates = computed(() =>
    dayForms.value
      .filter((item) => item.form !== 'future' && item.form !== 'rest')
      .filter((item) => getRemainingHours(item.day.date) > 0)
      .map((item) => item.day.date),
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
    () =>
      draftRows.value.length > 0 &&
      rowErrors.value.length === 0 &&
      !isSubmitting.value &&
      submittingRowIds.value.length === 0,
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

  function fillGeneratedContents(dates: string[], contents: string[]): void {
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
        if (hasAnyRow) {
          continue;
        }

        const remainingHours = getRemainingHours(date);
        if (remainingHours <= 0) {
          continue;
        }
        next.push(buildRow(date, { content, hours: remainingHours }));
      } else {
        next[blankIndex] = { ...next[blankIndex], content };
      }
    }

    draftRows.value = next;
    expandedDates.value = [...new Set([...expandedDates.value, ...dates])];
  }

  function getBlankEditableDates(): string[] {
    return editableDates.value.filter((date) => {
      const rows = draftRows.value.filter((row) => row.reportDate === date);
      return rows.length === 0 || rows.some((row) => !row.content.trim());
    });
  }

  function getRemainingHours(reportDate: string): number {
    const submittedHours = days().find((day) => day.date === reportDate)?.totalHours ?? 0;
    const newDraftHours = draftRows.value
      .filter((row) => row.reportDate === reportDate && !row.sourceId)
      .reduce((sum, row) => sum + (Number.isFinite(row.hours) ? row.hours : 0), 0);
    return calculateRemainingHours(submittedHours, newDraftHours);
  }

  function getMaxHoursForRow(rowId: string): number {
    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row) {
      return 0;
    }

    const day = days().find((item) => item.date === row.reportDate);
    let submittedHours = day?.totalHours ?? 0;

    // 可编辑的旧明细已经计入 day.totalHours，编辑时应扣除它原来的工时再计算上限。
    if (row.sourceId) {
      const sourceDetail = day?.details.find((detail) => detail.id === row.sourceId);
      submittedHours -= sourceDetail?.hours ?? 0;
    }

    const otherNewDraftHours = draftRows.value
      .filter((item) => item.reportDate === row.reportDate && !item.sourceId && item.rowId !== rowId)
      .reduce((sum, item) => sum + (Number.isFinite(item.hours) ? item.hours : 0), 0);

    return calculateRemainingHours(submittedHours, otherNewDraftHours);
  }

  function addRow(reportDate: string): void {
    const remainingHours = getRemainingHours(reportDate);
    if (remainingHours <= 0) {
      return;
    }

    draftRows.value = [...draftRows.value, buildRow(reportDate, { hours: remainingHours })];
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
    const remainingHours = getRemainingHours(source.reportDate);
    if (remainingHours <= 0) {
      return;
    }

    // 复制出的行是全新记录，必须清掉 sourceId，否则提交时会去更新原记录
    const copy: WeekFillDraftRow = {
      ...source,
      rowId: createRowId(),
      sourceId: null,
      hours: Math.min(source.hours > 0 ? source.hours : remainingHours, remainingHours),
    };
    const next = [...draftRows.value];
    next.splice(index + 1, 0, copy);
    draftRows.value = next;
  }

  async function removeRow(rowId: string): Promise<void> {
    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row || deletingRowIds.value.includes(rowId)) {
      return;
    }

    if (!row.sourceId) {
      draftRows.value = draftRows.value.filter((item) => item.rowId !== rowId);
      return;
    }

    deletingRowIds.value = [...deletingRowIds.value, rowId];
    try {
      const result = await deleteEntry(row.sourceId);
      if (!isReportSuccessCode(result.code)) {
        showToast(`${row.reportDate} ${result.msg || '删除失败。'}`, 'error');
        return;
      }

      draftRows.value = draftRows.value.filter((item) => item.rowId !== rowId);
      showToast(result.msg || '删除成功。', 'success');
    } catch (error) {
      showToast(getErrorMessage(error, '删除工时失败。'), 'error');
    } finally {
      deletingRowIds.value = deletingRowIds.value.filter((item) => item !== rowId);
    }
  }

  function patchRow(rowId: string, patch: Partial<WeekFillDraftRow>): void {
    draftRows.value = draftRows.value.map((row) =>
      row.rowId === rowId ? { ...row, ...patch } : row,
    );
  }

  /**
   * 项目切换联动（spec §7）：按需加载该项目的工时类型列表。
   * 类型列表由 useProjectCatalog 缓存，重复调用不会重复请求；加载失败仅提示，不抛出。
   */
  async function applyProjectChange(nextProjectId: string): Promise<WorkTypeNode[]> {
    if (!nextProjectId) {
      return [];
    }

    try {
      return await loadWorkTypesByProject(nextProjectId);
    } catch (error) {
      showToast(getErrorMessage(error, '获取工时类型失败。'));
      return [];
    }
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

    await applyProjectChange(projectId);
  }

  function setRowWorkType(rowId: string, itemId: string): void {
    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row) {
      return;
    }

    const workTypes = getWorkTypesForProject(row.projectId);
    const flat = flattenWorkTypes(workTypes);
    const target = flat.find((node) => node.id === itemId);
    patchRow(rowId, { itemId, itemName: target?.name ?? '' });
  }

  function setRowHours(rowId: string, hours: number): void {
    const maxHours = getMaxHoursForRow(rowId);
    const nextHours = Number.isFinite(hours) ? Math.max(0, Math.min(hours, maxHours)) : 0;
    patchRow(rowId, { hours: nextHours });
  }

  function setRowContent(rowId: string, content: string): void {
    patchRow(rowId, { content });
  }

  function buildDetailRow(
    reportDate: string,
    detail: WeekDay['details'][number],
  ): WeekFillDraftRow {
    const project = detail.projectId
      ? projects().find((item) => item.id === detail.projectId)
      : undefined;
    const workTypes = detail.projectId ? getWorkTypesForProject(detail.projectId) : [];
    const workType = flattenWorkTypes(workTypes).find((node) => node.id === detail.itemId);

    return buildRow(reportDate, {
      sourceId: detail.id,
      content: detail.content,
      hours: detail.hours > 0 ? detail.hours : defaults.value.hours,
      projectId: detail.projectId ?? defaults.value.projectId,
      projectTitle: detail.projectTitle ?? project?.title ?? defaults.value.projectTitle,
      projectStatus: detail.projectStatus ?? project?.projectStatus ?? defaults.value.projectStatus,
      itemId: detail.itemId ?? defaults.value.itemId,
      itemName: detail.itemName ?? workType?.name ?? defaults.value.itemName,
      period: detail.period,
      status: detail.status,
      statusDesc: detail.statusDesc,
    });
  }

  /**
   * 页面加载、切周或周看板刷新后调用。
   * 1) 解析默认值（localStorage > AutoFillConfig > 空）
   * 2) 校正非法的「项目 A + 项目 B 的类型」组合
   * 3) 将上游所有可编辑明细同步为带 sourceId 的草稿
   * 4) 保留页面新建草稿和用户已经编辑过的旧草稿
   */
  async function initializeWeek(preserveDrafts = true): Promise<void> {
    const resolved = resolveDefaults(readLastUsedDefaults(), getAutoFillConfig());
    defaults.value = resolved;
    weekTheme.value = resolved.work;

    if (resolved.projectId && resolved.itemId) {
      try {
        const workTypes = await loadWorkTypesByProject(resolved.projectId);
        const flat = flattenWorkTypes(workTypes);
        if (!flat.some((node) => node.id === resolved.itemId)) {
          defaults.value = { ...resolved, itemId: '', itemName: '' };
        }
      } catch {
        // 加载失败不阻断页面，用户仍可手动选择
      }
    }

    const previousRows = preserveDrafts ? draftRows.value : [];
    const previousSourceRows = new Map(
      previousRows
        .filter((row) => row.sourceId)
        .map((row) => [row.sourceId as string, row]),
    );
    const syncedRows: WeekFillDraftRow[] = [];

    for (const item of dayForms.value) {
      for (const detail of item.day.details) {
        if (
          !detail.id ||
          isReadonlyTimesheetStatus(detail.status, detail.statusDesc, item.status.key)
        ) {
          continue;
        }

        const previous = previousSourceRows.get(detail.id);
        if (previous) {
          // 保留用户对可编辑旧记录的修改，只同步上游状态/期间等展示元数据。
          syncedRows.push({
            ...previous,
            reportDate: item.day.date,
            sourceId: detail.id,
            period: detail.period,
            status: detail.status,
            statusDesc: detail.statusDesc,
          });
        } else {
          syncedRows.push(buildDetailRow(item.day.date, detail));
        }
      }
    }

    const newDraftRows = previousRows.filter((row) => !row.sourceId);
    draftRows.value = [...syncedRows, ...newDraftRows];
    expandedDates.value = dayForms.value
      .filter((item) => item.form !== 'future' && item.form !== 'rest')
      .map((item) => item.day.date);
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
      showToast('请先填写工作内容。');
      return;
    }

    isGenerating.value = true;
    try {
      const contents = await generateContent(weekTheme.value.trim(), dates.length);
      if (contents.length < dates.length) {
        showToast('AI 暂时未生成足够内容，请稍后重试。', 'error');
        return;
      }

      fillGeneratedContents(dates, contents);
    } catch (error) {
      showToast(getErrorMessage(error, '生成工时失败。'), 'error');
    } finally {
      isGenerating.value = false;
    }
  }

  async function generateFromLastWeek(lastWeekContents: PreviousWeekContent[]): Promise<void> {
    if (!defaults.value.projectId || !defaults.value.itemId) {
      showToast('请先选择默认项目和工时类型。');
      return;
    }

    const contentByWeekday = new Map<string, string>(
      lastWeekContents
        .map((item) => ({ weekday: item.weekday, content: item.content.trim() }))
        .filter((item) => item.weekday && item.content)
        .map((item) => [item.weekday, item.content]),
    );
    const dates = getBlankEditableDates().filter((date) => contentByWeekday.has(getWeekdayLabel(date)));
    if (dates.length === 0) {
      showToast('上周没有与本周待填日期对应的填报内容。');
      return;
    }

    const targetWeekdays = dates.map(getWeekdayLabel);
    const references = [...new Set(targetWeekdays)].map((weekday) => ({
      weekday,
      content: contentByWeekday.get(weekday) ?? '',
    }));

    isGenerating.value = true;
    try {
      const contents = await generateContentFromLastWeek(references, targetWeekdays);
      if (contents.length < dates.length) {
        showToast('AI 暂时未生成足够内容，请稍后重试。', 'error');
        return;
      }

      fillGeneratedContents(dates, contents);
    } catch (error) {
      showToast(getErrorMessage(error, '根据上周内容生成工时失败。'), 'error');
    } finally {
      isGenerating.value = false;
    }
  }

  /** 行内 ✨：优先基于本行已有内容优化；为空时使用默认工作内容生成。 */
  async function regenerateRow(rowId: string): Promise<void> {
    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row) {
      return;
    }

    const work = row.content.trim() || weekTheme.value.trim();
    if (!work) {
      showToast('请先填写工作内容。');
      return;
    }

    isGenerating.value = true;
    try {
      const contents = await generateContent(work, 1);
      const content = contents[0];
      if (!content) {
        showToast('AI 暂时未生成内容，请稍后重试。', 'error');
        return;
      }

      patchRow(rowId, { content });
    } catch (error) {
      showToast(getErrorMessage(error, '生成工时失败。'), 'error');
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

    await applyProjectChange(projectId);
  }

  function setDefaultWorkType(itemId: string): void {
    const workTypes = getWorkTypesForProject(defaults.value.projectId);
    const flat = flattenWorkTypes(workTypes);
    const target = flat.find((node) => node.id === itemId);
    defaults.value = { ...defaults.value, itemId, itemName: target?.name ?? '' };
  }

  function setDefaultHours(hours: number): void {
    defaults.value = { ...defaults.value, hours };
  }

  function setWeekTheme(value: string): void {
    weekTheme.value = value;
  }

  async function revokeDetail(detailId: string): Promise<void> {
    if (!detailId || revokingDetailIds.value.length > 0) {
      return;
    }

    revokingDetailIds.value = [...revokingDetailIds.value, detailId];
    try {
      const result = await revokeEntry(detailId);
      if (!isReportSuccessCode(result.code)) {
        showToast(result.msg || '撤回失败。', 'error');
        return;
      }

      showToast(result.msg || '撤回成功。', 'success');
      await refreshWeekBoard();
      await initializeWeek();
    } catch (error) {
      showToast(getErrorMessage(error, '撤回工时失败。'), 'error');
    } finally {
      revokingDetailIds.value = revokingDetailIds.value.filter((id) => id !== detailId);
    }
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

  async function prepareFlow(
    row: WeekFillDraftRow,
    item: WeekFillSubmitItem,
  ): Promise<{ taskId: string; buttonKey: string } | null> {
    if (!row.sourceId) {
      return null;
    }

    let flowResult;
    try {
      flowResult = await getReportFlowTask(row.sourceId);
      item.steps.push(toSubmitStep('flow', flowResult));
    } catch (error) {
      item.steps.push(toErrorStep('flow', error, '获取提交流程失败。'));
      return null;
    }

    if (!isReportSuccessCode(flowResult.code)) {
      return null;
    }
    if (!flowResult.taskId) {
      item.errorMessage = '上游未返回有效 taskId。';
      return null;
    }

    let buttonsResult;
    try {
      buttonsResult = await getReportFlowButtons(flowResult.taskId);
      item.steps.push(toSubmitStep('buttons', buttonsResult));
    } catch (error) {
      item.steps.push(toErrorStep('buttons', error, '获取提交按钮失败。'));
      return null;
    }

    if (!isReportSuccessCode(buttonsResult.code)) {
      return null;
    }
    if (!buttonsResult.buttonKey) {
      item.errorMessage = '上游未返回重新提交按钮。';
      return null;
    }

    return {
      taskId: flowResult.taskId,
      buttonKey: buttonsResult.buttonKey,
    };
  }

  /**
   * 新建行通过前端直连 gzbdgc 的 reportBatch；
   * 带 sourceId 的行（审核失败重填）通过 flow 流程重新提交。
   */
  async function submitRow(rowId: string): Promise<WeekFillSubmitResult | null> {
    if (isSubmitting.value || submittingRowIds.value.includes(rowId)) {
      return null;
    }

    const row = draftRows.value.find((item) => item.rowId === rowId);
    if (!row) {
      return null;
    }

    const rowError = rowErrors.value.find((error) => error.rowId === rowId);
    if (rowError) {
      showToast(`${rowError.reportDate} ${rowError.message}`);
      return null;
    }

    submittingRowIds.value = [...submittingRowIds.value, rowId];
    const item = createSubmitItem(row, row.sourceId ? 'flow' : 'reportBatch');

    try {
      try {
        if (row.sourceId) {
          const prepared = await prepareFlow(row, item);
          if (prepared) {
            try {
              const response = await handleReportFlow(prepared.taskId, prepared.buttonKey, toEntry(row));
              item.steps.push(toSubmitStep('handle', response));
              item.success = isReportSuccessCode(response.code);
            } catch (error) {
              item.errorMessage = formatSubmitFailureMessage(error, '提交失败，请稍后重试');
              item.steps.push(toErrorStep('handle', error, '重新提交失败。'));
            }
          }
        } else {
          try {
            const response = await submitBatch(buildBatchPayload([toEntry(row)]));
            item.steps.push(toSubmitStep('reportBatch', response));
            item.success = isReportSuccessCode(response.code);
          } catch (error) {
            item.errorMessage = formatSubmitFailureMessage(error, '提交失败，请稍后重试');
            item.steps.push(toErrorStep('reportBatch', error, '批量提交失败。'));
          }
        }
      } catch (error) {
        const stepName: WeekFillSubmitStepName = row.sourceId ? 'handle' : 'reportBatch';
        item.errorMessage = formatSubmitFailureMessage(error, '提交失败，请稍后重试');
        item.steps.push(toErrorStep(stepName, error, '提交工时失败。'));
      }

      const result = buildSubmitResult([item]);
      submitResult.value = result;
      if (item.success) {
        draftRows.value = draftRows.value.filter((draftRow) => draftRow.rowId !== rowId);
        writeLastUsedDefaults({ ...defaults.value, work: weekTheme.value });
        showToast('提交完成', 'success');
      } else {
        showToast(`提交失败：${item.errorMessage ?? '请稍后重试'}`, 'error');
      }
      await refreshWeekBoard();
      if (item.success && draftRows.value.length === 0) {
        await initializeWeek();
      }

      return result;
    } finally {
      submittingRowIds.value = submittingRowIds.value.filter((id) => id !== rowId);
    }
  }

  async function submitAll(): Promise<WeekFillSubmitResult | null> {
    if (draftRows.value.length === 0 || submittingRowIds.value.length > 0) {
      showToast('没有待提交的内容。');
      return null;
    }

    const errors = rowErrors.value;
    if (errors.length > 0) {
      showToast(`${errors[0].reportDate} ${errors[0].message}`);
      return null;
    }

    isSubmitting.value = true;
    submitResult.value = null;
    try {
      const updates = draftRows.value.filter((row) => row.sourceId);
      const creates = draftRows.value.filter((row) => !row.sourceId);
      const flowItems = new Map<string, WeekFillSubmitItem>(
        updates.map((row) => [row.rowId, createSubmitItem(row, 'flow')]),
      );
      const items = [...flowItems.values()];
      const preparedFlows = new Map<string, { taskId: string; buttonKey: string }>();
      const successfulRowIds = new Set<string>();

      // 先为所有审核失败记录获取 taskId 和可用按钮，再逐条执行 handle。
      for (const row of updates) {
        const item = flowItems.get(row.rowId);
        if (!item || !row.sourceId) {
          continue;
        }

        const prepared = await prepareFlow(row, item);
        if (prepared) {
          preparedFlows.set(row.rowId, prepared);
        }
      }

      // 预请求全部完成后，再按行顺序执行重新提交。
      for (const row of updates) {
        const prepared = preparedFlows.get(row.rowId);
        const item = flowItems.get(row.rowId);
        if (!prepared || !item) {
          continue;
        }

        try {
          const result = await handleReportFlow(prepared.taskId, prepared.buttonKey, toEntry(row));
          item.steps.push(toSubmitStep('handle', result));
          if (isReportSuccessCode(result.code)) {
            item.success = true;
            successfulRowIds.add(row.rowId);
          }
        } catch (error) {
          item.errorMessage = formatSubmitFailureMessage(error, '提交失败，请稍后重试');
          item.steps.push(toErrorStep('handle', error, '重新提交失败。'));
        }
      }

      if (creates.length > 0) {
        const batchItems = creates.map((row) => createSubmitItem(row, 'reportBatch'));
        items.push(...batchItems);

        try {
          const result = await submitBatch(buildBatchPayload(creates.map(toEntry)));
          const step = toSubmitStep('reportBatch', result);
          for (const item of batchItems) {
            item.steps.push(step);
            item.success = isReportSuccessCode(result.code);
            if (item.success) {
              successfulRowIds.add(item.rowId);
            }
          }
        } catch (error) {
          const step = toErrorStep('reportBatch', error, '批量提交失败。');
          const message = formatSubmitFailureMessage(error, '提交失败，请稍后重试');
          for (const item of batchItems) {
            item.errorMessage = message;
            item.steps.push(step);
          }
        }
      }

      const result = buildSubmitResult(items);
      submitResult.value = result;
      const allRowsSucceeded = successfulRowIds.size === draftRows.value.length;
      draftRows.value = draftRows.value.filter((row) => !successfulRowIds.has(row.rowId));
      if (allRowsSucceeded) {
        writeLastUsedDefaults({ ...defaults.value, work: weekTheme.value });
      }
      const summary = buildSubmitSummary(result);
      showToast(summary.message, summary.type);
      await wait(SUBMIT_REFRESH_DELAY_MS);
      await refreshWeekBoard();
      if (allRowsSucceeded) {
        await initializeWeek();
      }
      return result;
    } catch (error) {
      showToast(getErrorMessage(error, '提交工时失败。'), 'error');
      return submitResult.value;
    } finally {
      isSubmitting.value = false;
    }
  }

  function clearSubmitResult(): void {
    submitResult.value = null;
  }

  return {
    draftRows,
    defaults,
    weekTheme,
    isGenerating,
    isSubmitting,
    submitResult,
    submittingRowIds,
    deletingRowIds,
    revokingDetailIds,
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
    generateFromLastWeek,
    regenerateRow,
    setDefaultProject,
    setDefaultWorkType,
    setDefaultHours,
    setWeekTheme,
    getRemainingHours,
    getMaxHoursForRow,
    revokeDetail,
    toggleDate,
    submitRow,
    submitAll,
    clearSubmitResult,
  };
}
