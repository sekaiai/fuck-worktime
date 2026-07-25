import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { buildBatchPayload, generateContent, submitBatch } from '../api/timesheet-client';
import type { Project, TimesheetEntry, WorkTypeNode } from '../types/timesheet';
import { getTodayKey } from '../utils/date';
import type { WorkTypeGroup } from '../utils/work-types';

interface ResultDialogState {
  open: boolean;
  title: string;
  message: string;
}

function createDialogState(): ResultDialogState {
  return {
    open: false,
    title: '',
    message: '',
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function useManualFill(options: {
  fillableDays: () => { date: string }[];
  projects: () => Project[];
  getWorkTypeGroups: (workTypes: WorkTypeNode[]) => WorkTypeGroup[];
  findWorkType: (groups: WorkTypeGroup[], itemId: string) => WorkTypeNode | null;
  loadWorkTypesByProject: (projectId: string) => Promise<WorkTypeNode[]>;
  refreshWeekBoard: () => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const { fillableDays, projects, getWorkTypeGroups, findWorkType, loadWorkTypesByProject, refreshWeekBoard, showToast } = options;

  const isVisible = shallowRef(false);
  const recommendedDaysToGenerate = shallowRef<number | null>(null);
  const preferredReportDate = shallowRef<string | null>(null);
  const preferredStep = shallowRef<1 | 2 | 3>(1);
  const workTypes = shallowRef<WorkTypeNode[]>([]);
  const projectId = shallowRef('');
  const workTypeGroupId = shallowRef('');
  const workTypeId = shallowRef('');
  const hours = shallowRef(8);
  const work = shallowRef('');
  const daysToGenerate = shallowRef(0);
  const entries = shallowRef<TimesheetEntry[]>([]);
  const isGenerating = shallowRef(false);
  const isSubmitting = shallowRef(false);
  const currentStep = shallowRef<1 | 2 | 3>(1);
  const compactReviewMode = shallowRef(true);
  const resultDialog = shallowRef<ResultDialogState>(createDialogState());

  const maxFillDays = computed(() => fillableDays().length);
  const sortedFillableDays = computed(() => [...fillableDays()].sort((a, b) => a.date.localeCompare(b.date)));
  const selectedProject = computed(() => projects().find((p) => p.id === projectId.value) ?? null);
  const workTypeGroups = computed(() => getWorkTypeGroups(workTypes.value));
  const selectedWorkType = computed(() => findWorkType(workTypeGroups.value, workTypeId.value));
  const availableWorkTypes = computed(() => workTypeGroups.value.find((g) => g.id === workTypeGroupId.value)?.children ?? []);
  const previewDates = computed(() => sortedFillableDays.value.slice(0, 5));

  function resetEntries(): void {
    entries.value = [];
  }

  function syncStateWithFillableDays(): void {
    if (daysToGenerate.value === 0 || daysToGenerate.value > maxFillDays.value) {
      daysToGenerate.value = maxFillDays.value;
    }

    if (maxFillDays.value === 0) {
      resetEntries();
      isVisible.value = false;
    }
  }

  function resetForm(): void {
    projectId.value = '';
    workTypeGroupId.value = '';
    workTypeId.value = '';
    hours.value = 8;
    work.value = '';
    daysToGenerate.value = maxFillDays.value;
    workTypes.value = [];
    currentStep.value = 1;
    compactReviewMode.value = true;
    resetEntries();
  }

  function open(): boolean {
    if (maxFillDays.value === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = null;
    preferredReportDate.value = null;
    preferredStep.value = 1;
    currentStep.value = 1;
    isVisible.value = true;
    syncStateWithFillableDays();
    return true;
  }

  function quickFillOneDay(): boolean {
    if (maxFillDays.value === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = 1;
    preferredReportDate.value = [...fillableDays()].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
    preferredStep.value = 2;
    currentStep.value = 2;
    isVisible.value = true;
    syncStateWithFillableDays();
    return true;
  }

  function close(): void {
    resultDialog.value = { ...resultDialog.value, open: false };
    currentStep.value = 1;
    isVisible.value = false;
  }

  async function setProject(nextProjectId: string): Promise<void> {
    projectId.value = nextProjectId;
    workTypeGroupId.value = '';
    workTypeId.value = '';
    resetEntries();

    try {
      workTypes.value = nextProjectId ? await loadWorkTypesByProject(nextProjectId) : [];
    } catch (error) {
      workTypes.value = [];
      showToast(getErrorMessage(error, '获取工时类型失败。'));
    }
  }

  function setWorkTypeGroup(nextGroupId: string): void {
    workTypeGroupId.value = nextGroupId;
    workTypeId.value = '';
    resetEntries();
  }

  function setWorkType(nextWorkTypeId: string): void {
    workTypeId.value = nextWorkTypeId;
    resetEntries();
  }

  function setCurrentStep(step: 1 | 2 | 3): void {
    if (step === 3 && entries.value.length === 0) {
      showToast('请先生成工时列表。');
      return;
    }

    currentStep.value = step;
  }

  function setHours(nextValue: number): void {
    hours.value = nextValue;
  }

  function setDaysToGenerate(nextValue: number): void {
    daysToGenerate.value = nextValue;
  }

  function setWork(nextValue: string): void {
    work.value = nextValue;
  }

  function setCompactReviewMode(nextValue: boolean): void {
    compactReviewMode.value = nextValue;
  }

  async function generateEntries(): Promise<void> {
    const project = selectedProject.value;
    const workType = selectedWorkType.value;

    if (!project || !workType) {
      showToast('请选择项目和二级工时类型。');
      return;
    }
    if (!work.value.trim()) {
      showToast('请先填写工作内容。');
      return;
    }
    if (daysToGenerate.value <= 0) {
      showToast('生成天数至少为 1。');
      return;
    }
    if (daysToGenerate.value > maxFillDays.value) {
      showToast('生成天数不能超过当前可补填的未填天数。');
      return;
    }

    resetEntries();
    isGenerating.value = true;
    try {
      const contents = await generateContent(work.value.trim(), daysToGenerate.value);
      const preferredDays =
        daysToGenerate.value === 1 && preferredReportDate.value
          ? sortedFillableDays.value.filter((d) => d.date === preferredReportDate.value).slice(0, 1)
          : [];
      const targetDays = preferredDays.length > 0 ? preferredDays : sortedFillableDays.value.slice(0, daysToGenerate.value);
      if (contents.length < targetDays.length) {
        showToast('AI 暂时未生成足够内容，请稍后重试。');
        return;
      }

      const nextEntries: TimesheetEntry[] = [];
      for (const [index, day] of targetDays.entries()) {
        const content = contents[index];
        if (!content) {
          showToast('AI 暂时未生成足够内容，请稍后重试。');
          return;
        }

        nextEntries.push({
          reportDate: day.date,
          projectId: project.id,
          projectTitle: project.title,
          projectStatus: project.projectStatus,
          itemId: workType.id,
          itemName: workType.name,
          content,
          hours: hours.value,
        });
      }

      entries.value = nextEntries;
      currentStep.value = 3;
    } catch (error) {
      showToast(getErrorMessage(error, '生成工时失败。'));
    } finally {
      isGenerating.value = false;
    }
  }

  function updateEntry(index: number, patch: Partial<TimesheetEntry>): void {
    const nextEntries = [...entries.value];
    nextEntries[index] = { ...nextEntries[index], ...patch };
    entries.value = nextEntries;
  }

  function updateEntryDate(index: number, nextDate: string): void {
    const fillableDateSet = new Set(fillableDays().map((d) => d.date));
    const duplicated = entries.value.some((e, i) => i !== index && e.reportDate === nextDate);
    if (!fillableDateSet.has(nextDate) || duplicated) {
      showToast('日期只能选择当前可补填日期，且不能重复。');
      return;
    }

    updateEntry(index, { reportDate: nextDate });
  }

  function updateEntryContent(index: number, nextValue: string): void {
    updateEntry(index, { content: nextValue });
  }

  function updateEntryHours(index: number, nextValue: number): void {
    const safeHours = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1;
    updateEntry(index, { hours: safeHours });
  }

  async function submitEntries(): Promise<void> {
    if (entries.value.length === 0) {
      showToast('请先生成工时列表。');
      return;
    }

    isSubmitting.value = true;
    try {
      const result = await submitBatch(buildBatchPayload(entries.value));
      resultDialog.value = {
        open: true,
        title: result.code === 200 ? '提交结果' : '提交失败',
        message: result.msg,
      };
      if (result.code === 200) {
        resetEntries();
        await refreshWeekBoard();
      }
    } catch (error) {
      resultDialog.value = {
        open: true,
        title: '提交失败',
        message: getErrorMessage(error, '提交工时失败。'),
      };
    } finally {
      isSubmitting.value = false;
    }
  }

  function closeResultDialog(): void {
    resultDialog.value = { ...resultDialog.value, open: false };
  }

  return {
    isVisible,
    projects,
    workTypes,
    projectId,
    workTypeGroupId,
    workTypeId,
    hours,
    work,
    daysToGenerate,
    entries,
    isGenerating,
    isSubmitting,
    currentStep,
    compactReviewMode,
    resultDialog,
    maxFillDays,
    sortedFillableDays,
    selectedProject,
    workTypeGroups,
    selectedWorkType,
    availableWorkTypes,
    previewDates,
    open,
    close,
    quickFillOneDay,
    setProject,
    setWorkTypeGroup,
    setWorkType,
    setCurrentStep,
    setHours,
    setDaysToGenerate,
    setWork,
    setCompactReviewMode,
    generateEntries,
    updateEntryDate,
    updateEntryContent,
    updateEntryHours,
    submitEntries,
    closeResultDialog,
  };
}
