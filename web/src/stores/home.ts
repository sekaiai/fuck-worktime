import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';

import { ApiError } from '../api/request';
import {
  buildBatchPayload,
  disableAutoFill,
  generateContent,
  getAutoFillConfig,
  getProjects,
  getWeekBoard,
  getWorkTypes,
  runAutoFillNow,
  saveAutoFillConfig,
  submitBatch,
} from '../api/timesheet-client';
import { useAuthStore } from './auth';
import type { AutoFillConfig, AutoFillStatus } from '../types/auto-fill';
import type { Project, TimesheetEntry, WeekBoardResponse, WeekDay, WorkTypeNode } from '../types/timesheet';
import { formatWeekRange, getTodayKey, getWeekStart, shiftDateKeyByDays } from '../utils/date';
import {
  getProjectsCacheKey,
  getSessionCache,
  getWorkTypesCacheKey,
  setSessionCache,
} from '../utils/cache';
import { buildWorkTypeGroups, findWorkTypeById } from '../utils/work-types';

interface ResultDialogState {
  open: boolean;
  title: string;
  message: string;
}

const DEFAULT_REPORT_TIME = '17:00';

function createDialogState(): ResultDialogState {
  return {
    open: false,
    title: '',
    message: '',
  };
}

export const useHomeStore = defineStore('home', () => {
  const board = shallowRef<WeekBoardResponse | null>(null);
  const isWeekLoading = shallowRef(false);
  const errorMessage = shallowRef('');
  const errorCode = shallowRef('');
  const currentDate = shallowRef(getWeekStart());
  const selectedDayDate = shallowRef('');

  const projects = shallowRef<Project[]>([]);
  const isProjectsLoading = shallowRef(false);
  const workTypeMap = shallowRef<Record<string, WorkTypeNode[]>>({});

  const autoFillConfig = shallowRef<AutoFillConfig | null>(null);
  const isAutoFillLoading = shallowRef(false);
  const isSaving = shallowRef(false);
  const isDisabling = shallowRef(false);
  const isTriggering = shallowRef(false);
  const autoIsOpen = shallowRef(false);
  const autoWorkTypes = shallowRef<WorkTypeNode[]>([]);
  const autoProjectId = shallowRef('');
  const autoWorkTypeGroupId = shallowRef('');
  const autoItemId = shallowRef('');
  const autoHours = shallowRef(8);
  const autoWork = shallowRef('');
  const autoReportTime = shallowRef(DEFAULT_REPORT_TIME);
  const autoDeadline = shallowRef('');
  const autoToastMessage = shallowRef('');
  const autoResultDialog = shallowRef<ResultDialogState>(createDialogState());

  const isManualFillVisible = shallowRef(false);
  const recommendedDaysToGenerate = shallowRef<number | null>(null);
  const preferredReportDate = shallowRef<string | null>(null);
  const preferredStep = shallowRef<1 | 2 | 3>(1);
  const manualWorkTypes = shallowRef<WorkTypeNode[]>([]);
  const manualProjectId = shallowRef('');
  const manualWorkTypeGroupId = shallowRef('');
  const manualWorkTypeId = shallowRef('');
  const manualHours = shallowRef(8);
  const manualWork = shallowRef('');
  const manualDaysToGenerate = shallowRef(0);
  const manualEntries = shallowRef<TimesheetEntry[]>([]);
  const isGenerating = shallowRef(false);
  const isSubmitting = shallowRef(false);
  const manualToastMessage = shallowRef('');
  const manualResultDialog = shallowRef<ResultDialogState>(createDialogState());
  const manualCurrentStep = shallowRef<1 | 2 | 3>(1);
  const compactReviewMode = shallowRef(true);

  let manualToastTimer: number | null = null;
  let autoToastTimer: number | null = null;

  const days = computed(() => board.value?.days ?? []);
  const fillableDays = computed(() =>
    days.value.filter((day) => !day.isWeekend && day.status === '未提交' && day.date <= getTodayKey()),
  );
  const totalHours = computed(() => board.value?.totalHours ?? 0);
  const workDays = computed(() => days.value.filter((day) => !day.isWeekend).length);
  const averageHours = computed(() => {
    if (workDays.value === 0) {
      return 0;
    }

    return Number((totalHours.value / workDays.value).toFixed(1));
  });
  const weekTitle = computed(() => board.value?.currentWeek || '本周填报状态');
  const weekRange = computed(() => formatWeekRange(days.value.map((day) => day.date)));
  const weekStartOfToday = computed(() => getWeekStart());
  const isCurrentWeek = computed(() => currentDate.value === weekStartOfToday.value);
  const selectedDay = computed(() => days.value.find((day) => day.date === selectedDayDate.value) ?? null);
  const notifyVisible = computed(() => autoFillStatus.value === 'enabled');
  const autoFillStatus = computed<AutoFillStatus>(() => {
    if (!autoFillConfig.value?.enabled) {
      return 'disabled';
    }

    if (autoFillConfig.value.expired || (autoFillConfig.value.deadline && autoFillConfig.value.deadline < getTodayKey())) {
      return 'expired';
    }

    return 'enabled';
  });
  const manualMaxFillDays = computed(() => fillableDays.value.length);
  const sortedFillableDays = computed(() =>
    [...fillableDays.value].sort((left, right) => left.date.localeCompare(right.date)),
  );
  const manualSelectedProject = computed(
    () => projects.value.find((project) => project.id === manualProjectId.value) ?? null,
  );
  const manualWorkTypeGroups = computed(() => buildWorkTypeGroups(manualWorkTypes.value));
  const manualSelectedWorkType = computed(() =>
    findWorkTypeById(manualWorkTypeGroups.value, manualWorkTypeId.value),
  );
  const manualAvailableWorkTypes = computed(
    () => manualWorkTypeGroups.value.find((group) => group.id === manualWorkTypeGroupId.value)?.children ?? [],
  );
  const manualPreviewDates = computed(() => sortedFillableDays.value.slice(0, 5));
  const autoWorkTypeGroups = computed(() => buildWorkTypeGroups(autoWorkTypes.value));
  const autoSelectedProject = computed(
    () => projects.value.find((project) => project.id === autoProjectId.value) ?? null,
  );
  const autoSelectedWorkTypeGroup = computed(
    () => autoWorkTypeGroups.value.find((group) => group.id === autoWorkTypeGroupId.value) ?? null,
  );
  const autoSelectedWorkType = computed(() => findWorkTypeById(autoWorkTypeGroups.value, autoItemId.value));
  const autoAvailableWorkTypes = computed(
    () => autoWorkTypeGroups.value.find((group) => group.id === autoWorkTypeGroupId.value)?.children ?? [],
  );

  function showManualToast(message: string): void {
    manualToastMessage.value = message;
    if (manualToastTimer !== null) {
      window.clearTimeout(manualToastTimer);
    }
    manualToastTimer = window.setTimeout(() => {
      manualToastMessage.value = '';
    }, 2600);
  }

  function showAutoToast(message: string): void {
    autoToastMessage.value = message;
    if (autoToastTimer !== null) {
      window.clearTimeout(autoToastTimer);
    }
    autoToastTimer = window.setTimeout(() => {
      autoToastMessage.value = '';
    }, 2600);
  }

  function resetManualEntries(): void {
    manualEntries.value = [];
  }

  function syncManualStateWithFillableDays(): void {
    if (manualDaysToGenerate.value === 0 || manualDaysToGenerate.value > fillableDays.value.length) {
      manualDaysToGenerate.value = fillableDays.value.length;
    }

    if (fillableDays.value.length === 0) {
      resetManualEntries();
      isManualFillVisible.value = false;
    }
  }

  function syncSelectedBoardDay(): void {
    const stillExists = days.value.some((day) => day.date === selectedDayDate.value);
    if (stillExists) {
      return;
    }

    const firstFilledDay = days.value.find((day) => canInspectDay(day));
    selectedDayDate.value = firstFilledDay?.date ?? '';
  }

  function resetManualForm(): void {
    manualProjectId.value = '';
    manualWorkTypeGroupId.value = '';
    manualWorkTypeId.value = '';
    manualHours.value = 8;
    manualWork.value = '';
    manualDaysToGenerate.value = fillableDays.value.length;
    manualWorkTypes.value = [];
    manualCurrentStep.value = 1;
    compactReviewMode.value = true;
    resetManualEntries();
  }

  function resetAutoForm(): void {
    autoProjectId.value = '';
    autoWorkTypeGroupId.value = '';
    autoItemId.value = '';
    autoHours.value = 8;
    autoWork.value = '';
    autoReportTime.value = DEFAULT_REPORT_TIME;
    autoDeadline.value = '';
    autoWorkTypes.value = [];
  }

  function syncAutoWorkTypeGroup(nextItemId = autoItemId.value): void {
    if (!nextItemId || autoWorkTypeGroupId.value) {
      return;
    }

    autoWorkTypeGroupId.value =
      autoWorkTypeGroups.value.find((group) => group.children.some((child) => child.id === nextItemId))?.id ?? '';
  }

  function syncAutoFormFromConfig(config: AutoFillConfig | null): void {
    if (!config) {
      resetAutoForm();
      return;
    }

    autoProjectId.value = config.projectId;
    autoWorkTypeGroupId.value = config.workTypeGroupId ?? '';
    autoItemId.value = config.itemId;
    autoHours.value = config.hours;
    autoWork.value = config.work;
    autoReportTime.value = config.reportTime || DEFAULT_REPORT_TIME;
    autoDeadline.value = config.deadline ?? '';
  }

  function isManualStepTwoReady(): boolean {
    return Boolean(manualProjectId.value && manualWorkTypeId.value);
  }

  function openManualFill(): boolean {
    if (fillableDays.value.length === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = null;
    preferredReportDate.value = null;
    preferredStep.value = 1;
    manualCurrentStep.value = 1;
    isManualFillVisible.value = true;
    syncManualStateWithFillableDays();
    void ensureProjectsLoaded().catch((error: unknown) => {
      showManualToast(getErrorMessage(error, '获取项目列表失败。'));
    });
    return true;
  }

  function closeManualFill(): void {
    manualResultDialog.value = { ...manualResultDialog.value, open: false };
    manualCurrentStep.value = 1;
    isManualFillVisible.value = false;
  }

  function quickFillOneDay(): boolean {
    if (fillableDays.value.length === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = 1;
    preferredReportDate.value = [...fillableDays.value].sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? null;
    preferredStep.value = 2;
    manualCurrentStep.value = 2;
    isManualFillVisible.value = true;
    syncManualStateWithFillableDays();
    return true;
  }

  async function loadWeek(date = currentDate.value): Promise<boolean> {
    currentDate.value = getWeekStart(date);
    isWeekLoading.value = true;
    errorMessage.value = '';
    errorCode.value = '';

    try {
      board.value = await getWeekBoard(currentDate.value);
      syncSelectedBoardDay();
      syncManualStateWithFillableDays();
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        errorMessage.value = error.message;
        errorCode.value = error.code ?? '';
      } else {
        errorMessage.value = '获取填报状态失败，请稍后重试。';
      }
      return false;
    } finally {
      isWeekLoading.value = false;
    }
  }

  async function refreshWeekBoard(): Promise<void> {
    const authStore = useAuthStore();
    const ok = await loadWeek();
    if (!ok && errorCode.value === 'TOKEN_EXPIRED') {
      authStore.handleTokenExpired();
    }
  }

  async function switchWeek(direction: 'previous' | 'current' | 'next'): Promise<void> {
    const authStore = useAuthStore();
    const actions = {
      previous: () => loadWeek(shiftDateKeyByDays(currentDate.value, -7)),
      current: () => (isCurrentWeek.value ? Promise.resolve(true) : loadWeek(weekStartOfToday.value)),
      next: () => loadWeek(shiftDateKeyByDays(currentDate.value, 7)),
    } as const;
    const ok = await actions[direction]();

    if (!ok && errorCode.value === 'TOKEN_EXPIRED') {
      authStore.handleTokenExpired();
    }
  }

  async function loadProjectsByUser(userId: string): Promise<void> {
    const cacheKey = getProjectsCacheKey(userId);
    const cached = getSessionCache<Project[]>(cacheKey);
    if (cached) {
      projects.value = cached;
      return;
    }

    isProjectsLoading.value = true;
    try {
      const data = await getProjects();
      projects.value = data;
      setSessionCache(cacheKey, data);
    } finally {
      isProjectsLoading.value = false;
    }
  }

  async function ensureProjectsLoaded(): Promise<void> {
    const authStore = useAuthStore();
    if (!authStore.userId) {
      return;
    }

    await loadProjectsByUser(authStore.userId);
  }

  async function loadWorkTypesByProject(projectId: string): Promise<WorkTypeNode[]> {
    const cacheKey = getWorkTypesCacheKey(projectId);
    const cached = getSessionCache<WorkTypeNode[]>(cacheKey);
    if (cached) {
      workTypeMap.value = { ...workTypeMap.value, [projectId]: cached };
      return cached;
    }

    const data = await getWorkTypes(projectId);
    workTypeMap.value = { ...workTypeMap.value, [projectId]: data };
    setSessionCache(cacheKey, data);
    return data;
  }

  async function loadManualWorkTypes(projectId: string): Promise<void> {
    manualWorkTypes.value = projectId ? await loadWorkTypesByProject(projectId) : [];
  }

  async function loadAutoWorkTypes(projectId: string, showError = true): Promise<void> {
    if (!projectId) {
      autoWorkTypes.value = [];
      autoWorkTypeGroupId.value = '';
      return;
    }

    try {
      autoWorkTypes.value = await loadWorkTypesByProject(projectId);
    } catch (error) {
      autoWorkTypes.value = [];
      autoWorkTypeGroupId.value = '';
      if (showError) {
        showAutoToast(getErrorMessage(error, '加载工时类型失败。'));
      }
    }
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
      return error.message;
    }

    return error instanceof Error ? error.message : fallback;
  }

  async function loadAutoFill(userId: string): Promise<void> {
    isAutoFillLoading.value = true;
    try {
      autoFillConfig.value = await getAutoFillConfig(userId);
      syncAutoFormFromConfig(autoFillConfig.value);
      if (autoFillConfig.value?.projectId) {
        await loadAutoWorkTypes(autoFillConfig.value.projectId, false);
        syncAutoWorkTypeGroup(autoFillConfig.value.itemId);
      }
    } catch {
      autoFillConfig.value = null;
      resetAutoForm();
    } finally {
      isAutoFillLoading.value = false;
    }
  }

  async function initialize(): Promise<void> {
    const authStore = useAuthStore();
    const ok = await authStore.restoreAuth();
    if (!ok || !authStore.userId) {
      return;
    }

    await Promise.all([refreshWeekBoard(), loadAutoFill(authStore.userId)]);
  }

  function selectBoardDay(day: WeekDay): void {
    if (!canInspectDay(day)) {
      return;
    }

    selectedDayDate.value = day.date;
  }

  function canInspectDay(day: WeekDay): boolean {
    return !day.isWeekend && day.details.length > 0 && day.status !== '未提交';
  }

  async function setManualProject(nextProjectId: string): Promise<void> {
    manualProjectId.value = nextProjectId;
    manualWorkTypeGroupId.value = '';
    manualWorkTypeId.value = '';
    resetManualEntries();

    try {
      await loadManualWorkTypes(nextProjectId);
    } catch (error) {
      manualWorkTypes.value = [];
      showManualToast(getErrorMessage(error, '获取工时类型失败。'));
    }
  }

  function setManualWorkTypeGroup(nextGroupId: string): void {
    manualWorkTypeGroupId.value = nextGroupId;
    manualWorkTypeId.value = '';
    resetManualEntries();
  }

  function setManualWorkType(nextWorkTypeId: string): void {
    manualWorkTypeId.value = nextWorkTypeId;
    resetManualEntries();
  }

  function setManualCurrentStep(step: 1 | 2 | 3): void {
    if (step === 3 && manualEntries.value.length === 0) {
      showManualToast('请先生成工时列表。');
      return;
    }

    manualCurrentStep.value = step;
  }

  function setManualHours(nextValue: number): void {
    manualHours.value = nextValue;
  }

  function setManualDaysToGenerate(nextValue: number): void {
    manualDaysToGenerate.value = nextValue;
  }

  function setManualWork(nextValue: string): void {
    manualWork.value = nextValue;
  }

  function setCompactReviewMode(nextValue: boolean): void {
    compactReviewMode.value = nextValue;
  }

  async function generateManualEntries(): Promise<void> {
    const project = manualSelectedProject.value;
    const workType = manualSelectedWorkType.value;

    if (!project || !workType) {
      showManualToast('请选择项目和二级工时类型。');
      return;
    }
    if (!manualWork.value.trim()) {
      showManualToast('请先填写工作内容。');
      return;
    }
    if (manualDaysToGenerate.value <= 0) {
      showManualToast('生成天数至少为 1。');
      return;
    }
    if (manualDaysToGenerate.value > manualMaxFillDays.value) {
      showManualToast('生成天数不能超过当前可补填的未填天数。');
      return;
    }

    isGenerating.value = true;
    try {
      const contents = await generateContent(manualWork.value.trim(), manualDaysToGenerate.value);
      const preferredDays =
        manualDaysToGenerate.value === 1 && preferredReportDate.value
          ? sortedFillableDays.value.filter((day) => day.date === preferredReportDate.value).slice(0, 1)
          : [];
      const targetDays =
        preferredDays.length > 0
          ? preferredDays
          : sortedFillableDays.value.slice(0, manualDaysToGenerate.value);
      manualEntries.value = targetDays.map((day, index) => ({
        reportDate: day.date,
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        itemId: workType.id,
        itemName: workType.name,
        content: contents[index] ?? '日常工作处理',
        hours: manualHours.value,
      }));
      manualCurrentStep.value = 3;
    } catch (error) {
      showManualToast(getErrorMessage(error, '生成工时失败。'));
    } finally {
      isGenerating.value = false;
    }
  }

  function updateManualEntry(index: number, patch: Partial<TimesheetEntry>): void {
    const nextEntries = [...manualEntries.value];
    nextEntries[index] = {
      ...nextEntries[index],
      ...patch,
    };
    manualEntries.value = nextEntries;
  }

  function updateManualEntryDate(index: number, nextDate: string): void {
    const fillableDateSet = new Set(fillableDays.value.map((day) => day.date));
    const duplicated = manualEntries.value.some(
      (entry, entryIndex) => entryIndex !== index && entry.reportDate === nextDate,
    );
    if (!fillableDateSet.has(nextDate) || duplicated) {
      showManualToast('日期只能选择当前可补填日期，且不能重复。');
      return;
    }

    updateManualEntry(index, { reportDate: nextDate });
  }

  function updateManualEntryContent(index: number, nextValue: string): void {
    updateManualEntry(index, { content: nextValue });
  }

  function updateManualEntryHours(index: number, nextValue: number): void {
    const safeHours = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1;
    updateManualEntry(index, { hours: safeHours });
  }

  async function submitManualEntries(): Promise<void> {
    if (manualEntries.value.length === 0) {
      showManualToast('请先生成工时列表。');
      return;
    }

    isSubmitting.value = true;
    try {
      const result = await submitBatch(buildBatchPayload(manualEntries.value));
      manualResultDialog.value = {
        open: true,
        title: result.code === 200 ? '提交结果' : '提交失败',
        message: result.msg,
      };
      if (result.code === 200) {
        resetManualEntries();
        await refreshWeekBoard();
      }
    } catch (error) {
      manualResultDialog.value = {
        open: true,
        title: '提交失败',
        message: getErrorMessage(error, '提交工时失败。'),
      };
    } finally {
      isSubmitting.value = false;
    }
  }

  function closeManualResultDialog(): void {
    manualResultDialog.value = { ...manualResultDialog.value, open: false };
  }

  async function toggleAutoFillOpen(): Promise<void> {
    autoIsOpen.value = !autoIsOpen.value;
    if (!autoIsOpen.value) {
      return;
    }

    try {
      await ensureProjectsLoaded();
      if (autoProjectId.value) {
        await loadAutoWorkTypes(autoProjectId.value, false);
        syncAutoWorkTypeGroup();
      }
    } catch (error) {
      showAutoToast(getErrorMessage(error, '加载项目或工时类型失败。'));
    }
  }

  async function setAutoProject(nextProjectId: string): Promise<void> {
    autoProjectId.value = nextProjectId;
    autoWorkTypeGroupId.value = '';
    autoItemId.value = '';
    await loadAutoWorkTypes(nextProjectId);
  }

  function setAutoWorkTypeGroup(nextGroupId: string): void {
    autoWorkTypeGroupId.value = nextGroupId;
    autoItemId.value = '';
  }

  function setAutoItem(nextItemId: string): void {
    autoItemId.value = nextItemId;
  }

  function setAutoHours(nextValue: number): void {
    autoHours.value = nextValue;
  }

  function setAutoWork(nextValue: string): void {
    autoWork.value = nextValue;
  }

  function setAutoReportTime(nextValue: string): void {
    autoReportTime.value = nextValue;
  }

  function setAutoDeadline(nextValue: string): void {
    autoDeadline.value = nextValue;
  }

  async function saveCurrentAutoFillConfig(): Promise<void> {
    const authStore = useAuthStore();

    if (!authStore.userId) {
      showAutoToast('请先登录后再配置自动填报。');
      return;
    }

    if (!autoProjectId.value || !autoWorkTypeGroupId.value || !autoItemId.value) {
      showAutoToast('项目、一级工时类型和二级工时类型为必填项。');
      return;
    }

    if (!Number.isFinite(autoHours.value) || autoHours.value <= 0) {
      showAutoToast('工时必须大于 0。');
      return;
    }

    if (!autoWork.value.trim()) {
      showAutoToast('工作内容为必填项。');
      return;
    }

    if (!autoSelectedProject.value || !autoSelectedWorkTypeGroup.value || !autoSelectedWorkType.value) {
      showAutoToast('请选择有效的项目和工时类型。');
      return;
    }

    isSaving.value = true;
    try {
      const result = await saveAutoFillConfig({
        userId: authStore.userId,
        enabled: true,
        projectId: autoProjectId.value,
        projectTitle: autoSelectedProject.value.title,
        projectStatus: autoSelectedProject.value.status,
        workTypeGroupId: autoWorkTypeGroupId.value,
        workTypeGroupName: autoSelectedWorkTypeGroup.value.name,
        itemId: autoItemId.value,
        itemName: autoSelectedWorkType.value.name,
        hours: autoHours.value,
        work: autoWork.value.trim(),
        reportTime: autoReportTime.value.trim() || DEFAULT_REPORT_TIME,
        deadline: autoDeadline.value || null,
      });

      autoResultDialog.value = {
        open: true,
        title: result.code === 200 ? '保存成功' : '保存失败',
        message: result.msg,
      };
      if (result.code === 200) {
        await loadAutoFill(authStore.userId);
      }
    } catch (error) {
      autoResultDialog.value = {
        open: true,
        title: '保存失败',
        message: getErrorMessage(error, '保存自动填报失败'),
      };
    } finally {
      isSaving.value = false;
    }
  }

  async function runAutoFillConfigNow(): Promise<void> {
    const authStore = useAuthStore();
    if (!authStore.userId) {
      showAutoToast('请先登录再执行自动填报。');
      return;
    }

    isTriggering.value = true;
    try {
      const result = await runAutoFillNow(authStore.userId);
      autoResultDialog.value = {
        open: true,
        title: result.code === 200 ? '执行成功' : '执行失败',
        message: result.msg,
      };
      await loadAutoFill(authStore.userId);
    } catch (error) {
      autoResultDialog.value = {
        open: true,
        title: '执行失败',
        message: getErrorMessage(error, '立即执行自动填报失败'),
      };
    } finally {
      isTriggering.value = false;
    }
  }

  async function disableCurrentAutoFillConfig(): Promise<void> {
    const authStore = useAuthStore();
    if (!authStore.userId) {
      return;
    }

    isDisabling.value = true;
    try {
      const result = await disableAutoFill(authStore.userId);
      autoResultDialog.value = {
        open: true,
        title: result.code === 200 ? '禁用成功' : '禁用失败',
        message: result.msg,
      };
      if (result.code === 200) {
        await loadAutoFill(authStore.userId);
      }
    } catch (error) {
      autoResultDialog.value = {
        open: true,
        title: '禁用失败',
        message: getErrorMessage(error, '关闭自动填报失败'),
      };
    } finally {
      isDisabling.value = false;
    }
  }

  function closeAutoResultDialog(): void {
    autoResultDialog.value = { ...autoResultDialog.value, open: false };
  }

  const autoOverviewItems = computed(() => {
    if (!autoFillConfig.value) {
      return [];
    }

    return [
      { label: '项目', value: autoFillConfig.value.projectTitle || '未配置' },
      { label: '工时类型', value: autoFillConfig.value.itemName || '未配置' },
      { label: '填报时间', value: autoFillConfig.value.reportTime || DEFAULT_REPORT_TIME },
      { label: '截止日期', value: autoFillConfig.value.deadline || '长期有效' },
    ];
  });

  return {
    board,
    isWeekLoading,
    errorMessage,
    errorCode,
    currentDate,
    selectedDayDate,
    projects,
    isProjectsLoading,
    workTypeMap,
    autoFillConfig,
    isAutoFillLoading,
    isSaving,
    isDisabling,
    isTriggering,
    autoIsOpen,
    autoWorkTypes,
    autoProjectId,
    autoWorkTypeGroupId,
    autoItemId,
    autoHours,
    autoWork,
    autoReportTime,
    autoDeadline,
    autoToastMessage,
    autoResultDialog,
    isManualFillVisible,
    recommendedDaysToGenerate,
    preferredReportDate,
    preferredStep,
    manualWorkTypes,
    manualProjectId,
    manualWorkTypeGroupId,
    manualWorkTypeId,
    manualHours,
    manualWork,
    manualDaysToGenerate,
    manualEntries,
    isGenerating,
    isSubmitting,
    manualToastMessage,
    manualResultDialog,
    manualCurrentStep,
    compactReviewMode,
    days,
    fillableDays,
    totalHours,
    workDays,
    averageHours,
    weekTitle,
    weekRange,
    isCurrentWeek,
    selectedDay,
    notifyVisible,
    autoFillStatus,
    manualMaxFillDays,
    sortedFillableDays,
    manualSelectedProject,
    manualWorkTypeGroups,
    manualSelectedWorkType,
    manualAvailableWorkTypes,
    manualPreviewDates,
    autoWorkTypeGroups,
    autoSelectedProject,
    autoSelectedWorkTypeGroup,
    autoSelectedWorkType,
    autoAvailableWorkTypes,
    autoOverviewItems,
    openManualFill,
    closeManualFill,
    quickFillOneDay,
    loadWeek,
    refreshWeekBoard,
    switchWeek,
    ensureProjectsLoaded,
    loadWorkTypesByProject,
    loadAutoFill,
    initialize,
    selectBoardDay,
    canInspectDay,
    setManualProject,
    setManualWorkTypeGroup,
    setManualWorkType,
    setManualCurrentStep,
    setManualHours,
    setManualDaysToGenerate,
    setManualWork,
    setCompactReviewMode,
    generateManualEntries,
    updateManualEntryDate,
    updateManualEntryContent,
    updateManualEntryHours,
    submitManualEntries,
    closeManualResultDialog,
    toggleAutoFillOpen,
    setAutoProject,
    setAutoWorkTypeGroup,
    setAutoItem,
    setAutoHours,
    setAutoWork,
    setAutoReportTime,
    setAutoDeadline,
    saveCurrentAutoFillConfig,
    runAutoFillConfigNow,
    disableCurrentAutoFillConfig,
    closeAutoResultDialog,
  };
});
