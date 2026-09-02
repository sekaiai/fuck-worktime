import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import {
  buildBatchPayload,
  deleteEntry,
  generateContent,
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
  ReportActionResponse,
  TimesheetEntry,
  WeekFillSubmitItem,
  WeekFillSubmitResult,
  WeekFillSubmitStep,
  WeekFillSubmitStepName,
  WeekDay,
  WorkTypeNode,
} from '../types/timesheet';
import type { WeekFillDefaults, WeekFillDraftRow, WeekFillRowError } from '../types/week-fill';
import { isReadonlyTimesheetStatus, mapDayStatus } from '../utils/timesheet-status';
import { calculateRemainingHours } from '../utils/week-fill-hours';
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

  function getRemainingHours(reportDate: string): number {
    const submittedHours = days().find((day) => day.date === reportDate)?.totalHours ?? 0;
    const newDraftHours = draftRows.value
      .filter((row) => row.reportDate === reportDate && !row.sourceId)
      .reduce((sum, row) => sum + (Number.isFinite(row.hours) ? row.hours : 0), 0);
    return calculateRemainingHours(submittedHours, newDraftHours);
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
    // 复制出的行是全新记录，必须清掉 sourceId，否则提交时会去更新原记录
    const copy: WeekFillDraftRow = { ...source, rowId: createRowId(), sourceId: null };
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
        showToast(`${row.reportDate} ${result.msg || '删除失败。'}`);
        return;
      }

      draftRows.value = draftRows.value.filter((item) => item.rowId !== rowId);
      showToast(result.msg || '删除成功。');
    } catch (error) {
      showToast(getErrorMessage(error, '删除工时失败。'));
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

  function buildDetailRow(
    reportDate: string,
    detail: WeekDay['details'][number],
  ): WeekFillDraftRow {
    const project = detail.projectId
      ? projects().find((item) => item.id === detail.projectId)
      : undefined;
    const workTypes = detail.projectId ? getWorkTypesForProject(detail.projectId) : [];
    const workType = workTypes
      .flatMap((node) => (node.children?.length ? node.children : [node]))
      .find((node) => node.id === detail.itemId);

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
        const flat = workTypes.flatMap((node) => (node.children?.length ? node.children : [node]));
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

  async function revokeDetail(detailId: string): Promise<void> {
    if (!detailId || revokingDetailIds.value.length > 0) {
      return;
    }

    revokingDetailIds.value = [...revokingDetailIds.value, detailId];
    try {
      const result = await revokeEntry(detailId);
      if (!isReportSuccessCode(result.code)) {
        showToast(result.msg || '撤回失败。');
        return;
      }

      showToast(result.msg || '撤回成功。');
      await refreshWeekBoard();
      await initializeWeek();
    } catch (error) {
      showToast(getErrorMessage(error, '撤回工时失败。'));
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
              item.steps.push(toErrorStep('handle', error, '重新提交失败。'));
            }
          }
        } else {
          try {
            const response = await submitBatch(buildBatchPayload([toEntry(row)]));
            item.steps.push(toSubmitStep('reportBatch', response));
            item.success = isReportSuccessCode(response.code);
          } catch (error) {
            item.steps.push(toErrorStep('reportBatch', error, '批量提交失败。'));
          }
        }
      } catch (error) {
        const stepName: WeekFillSubmitStepName = row.sourceId ? 'handle' : 'reportBatch';
        item.steps.push(toErrorStep(stepName, error, '提交工时失败。'));
      }

      const result = buildSubmitResult([item]);
      submitResult.value = result;
      if (item.success) {
        draftRows.value = draftRows.value.filter((draftRow) => draftRow.rowId !== rowId);
        writeLastUsedDefaults({ ...defaults.value, work: weekTheme.value });
      }
      showToast(result.msg || '提交完成。');
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
          for (const item of batchItems) {
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
      showToast(result.msg || '提交完成。');
      await refreshWeekBoard();
      if (allRowsSucceeded) {
        await initializeWeek();
      }
      return result;
    } catch (error) {
      showToast(getErrorMessage(error, '提交工时失败。'));
      return submitResult.value;
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
    regenerateRow,
    setDefaultProject,
    setDefaultWorkType,
    setDefaultHours,
    setWeekTheme,
    getRemainingHours,
    revokeDetail,
    toggleDate,
    submitRow,
    submitAll,
  };
}
