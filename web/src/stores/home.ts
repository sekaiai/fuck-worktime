import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { useAuthStore } from './auth';
import { useWeekBoard } from '../composables/useWeekBoard';
import { useProjectCatalog } from '../composables/useProjectCatalog';
import { useAutoFill } from '../composables/useAutoFill';
import { useWeekFill } from '../composables/useWeekFill';
import { useMonthCalendar } from '../composables/useMonthCalendar';
import { showToast } from '../composables/useToast';
import { getAutoFillConfig, getTimingList } from '../api/timesheet-client';
import { getWeekStart, shiftDateKeyByDays } from '../utils/date';
import type { AutoFillConfig } from '../types/auto-fill';
import type { TimingRecord } from '../types/timesheet';

export const useHomeStore = defineStore('home', () => {
  const authStore = useAuthStore();

  // Create the composables
  const weekBoard = useWeekBoard();
  const projectCatalog = useProjectCatalog();
  const monthCalendar = useMonthCalendar({
    fetchRange: (start, end) => getTimingList(start, end),
  });

  /** 自动填报弹窗由布局层统一渲染一份，顶栏与左栏共用该开关 */
  const isAutoFillDialogOpen = ref(false);
  /** 日历点击后需要滚动定位的日期；token 递增保证连点同一天也能触发 */
  const focusTarget = shallowRef<{ date: string; token: number } | null>(null);
  let focusToken = 0;

  // Auto fill composable
  const autoFill = useAutoFill({
    projects: () => projectCatalog.projects.value,
    getWorkTypeGroups: projectCatalog.getWorkTypeGroups,
    findWorkType: projectCatalog.findWorkType,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    loadAutoFillConfig: getAutoFillConfig,
    getUserId: () => authStore.userId,
    showToast,
  });

  const LAST_EXECUTION_STATUS_LABELS: Record<
    NonNullable<AutoFillConfig['lastExecutionStatus']>,
    string
  > = {
    success: '成功',
    failed: '失败',
    skipped: '跳过',
    expired: '过期',
  };

  function formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /** 最近执行结果文案：左栏常驻卡与设置弹窗共用同一份格式化逻辑 */
  const autoFillExecutionText = computed(() => {
    const config = autoFill.config.value;
    if (!config?.lastExecutionStatus) {
      return '';
    }

    const statusLabel = LAST_EXECUTION_STATUS_LABELS[config.lastExecutionStatus];
    return config.lastExecutedAt
      ? `${statusLabel}（${formatDateTime(config.lastExecutedAt)}）`
      : statusLabel;
  });

  /**
   * week-board 的明细只有 id/hours/content/status，不带项目与工时类型字段；
   * 用 timing/list（日历数据源）按明细 id 建立映射，补齐 projectId/projectTitle/itemId。
   */
  const timingDetailMap = shallowRef(new Map<string, TimingRecord>());

  function mergeTimingRecords(records: TimingRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const next = new Map(timingDetailMap.value);
    for (const record of records) {
      next.set(record.id, record);
    }
    timingDetailMap.value = next;
  }

  /** 拉取当前查看周（周一 ~ 周日）的填报记录，失败不阻塞主流程（只读行退回 ID 兜底） */
  async function syncTimingForWeek(): Promise<void> {
    const start = weekBoard.currentDate.value;
    const end = shiftDateKeyByDays(start, 6);
    try {
      mergeTimingRecords(await getTimingList(start, end));
    } catch {
      // 静默失败：明细行最多退化为显示原始 ID
    }
  }

  /** 补齐后的 days：明细按 id 从 timingDetailMap 合入缺失字段 */
  const enrichedDays = computed(() => {
    const map = timingDetailMap.value;
    if (map.size === 0) {
      return weekBoard.days.value;
    }

    return weekBoard.days.value.map((day) => {
      if (day.details.length === 0) {
        return day;
      }

      return {
        ...day,
        details: day.details.map((detail) => {
          const record = map.get(detail.id);
          if (!record) {
            return detail;
          }

          return {
            ...detail,
            projectId: detail.projectId ?? record.projectId,
            projectTitle: detail.projectTitle ?? record.projectTitle,
            itemId: detail.itemId ?? record.itemId,
          };
        }),
      };
    });
  });

  const weekFill = useWeekFill({
    days: () => enrichedDays.value,
    projects: () => projectCatalog.projects.value,
    getWorkTypesForProject: projectCatalog.getWorkTypesForProject,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    getAutoFillConfig: () => autoFill.config.value,
    refreshWeekBoard: async () => {
      await weekBoard.loadWeek();
    },
    showToast,
  });

  // Initialize function
  async function initialize(): Promise<void> {
    const ok = await authStore.restoreAuth();
    if (!ok || !authStore.userId) {
      return;
    }

    await Promise.all([
      weekBoard.loadWeek(),
      autoFill.initialize(authStore.userId),
      projectCatalog.loadProjectsByUser(authStore.userId),
    ]);

    // 明细补齐映射必须在 initializeWeek 之前就绪，否则已填报行拿不到项目/类型
    await syncTimingForWeek();

    // 必须在三者都完成后再初始化：依赖 days、projects 与 autoFill.config
    await weekFill.initializeWeek();
    // 日历是填报主流程的辅助视图，失败不阻塞首屏，故不 await
    void monthCalendar.load();
  }

  async function refreshWeekBoard(): Promise<void> {
    const ok = await weekBoard.loadWeek();
    if (ok) {
      await syncTimingForWeek();
      await weekFill.initializeWeek();
      void monthCalendar.load();
    }
    if (!ok && weekBoard.errorCode.value === 'TOKEN_EXPIRED') {
      authStore.handleTokenExpired();
    }
  }

  async function switchWeekAndReset(direction: 'previous' | 'current' | 'next'): Promise<void> {
    await weekBoard.switchWeek(direction);
    await syncTimingForWeek();
    await weekFill.initializeWeek(false);
    await monthCalendar.revealDate(weekBoard.currentDate.value);
  }

  /**
   * 日历点击：跨周则先切到该周并展开对应日期，同周则仅展开/收起该日。
   * 切换与展开完成后写入 focusTarget，由日期区块自行滚动定位。
   */
  async function focusCalendarDate(date: string): Promise<void> {
    const targetWeek = getWeekStart(date);
    if (targetWeek !== weekBoard.currentDate.value) {
      await weekBoard.loadWeek(targetWeek);
      await syncTimingForWeek();
      await weekFill.initializeWeek(false);
      await monthCalendar.revealDate(targetWeek);
    } else {
      weekFill.toggleDate(date);
    }

    focusToken += 1;
    focusTarget.value = { date, token: focusToken };
  }

  async function openAutoFillDialog(): Promise<void> {
    const ok = await autoFill.open();
    if (ok) {
      isAutoFillDialogOpen.value = true;
    }
  }

  function closeAutoFillDialog(): void {
    isAutoFillDialogOpen.value = false;
  }

  async function ensureProjectsLoaded(): Promise<void> {
    if (!authStore.userId) {
      return;
    }

    await projectCatalog.loadProjectsByUser(authStore.userId);
  }

  // Expose everything
  return {
    // Week board
    board: weekBoard.board,
    isWeekLoading: weekBoard.isWeekLoading,
    errorMessage: weekBoard.errorMessage,
    errorCode: weekBoard.errorCode,
    days: enrichedDays,
    fillableDays: weekBoard.fillableDays,
    totalHours: weekBoard.totalHours,
    workDays: weekBoard.workDays,
    averageHours: weekBoard.averageHours,
    weekTitle: weekBoard.weekTitle,
    weekRange: weekBoard.weekRange,
    isCurrentWeek: weekBoard.isCurrentWeek,
    currentDate: weekBoard.currentDate,
    selectedDayDate: weekBoard.selectedDayDate,
    selectedDay: weekBoard.selectedDay,
    loadWeek: weekBoard.loadWeek,
    switchWeek: weekBoard.switchWeek,
    selectBoardDay: weekBoard.selectBoardDay,
    canInspectDay: weekBoard.canInspectDay,

    // Project catalog
    projects: projectCatalog.projects,
    isProjectsLoading: projectCatalog.isProjectsLoading,
    workTypeMap: projectCatalog.workTypeMap,
    loadProjectsByUser: projectCatalog.loadProjectsByUser,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    getWorkTypesForProject: projectCatalog.getWorkTypesForProject,

    // Week fill
    weekFillRows: weekFill.draftRows,
    weekFillDefaults: weekFill.defaults,
    weekTheme: weekFill.weekTheme,
    isWeekFillGenerating: weekFill.isGenerating,
    isWeekFillSubmitting: weekFill.isSubmitting,
    weekFillSubmitResult: weekFill.submitResult,
    weekFillSubmittingRowIds: weekFill.submittingRowIds,
    weekFillDeletingRowIds: weekFill.deletingRowIds,
    weekFillRevokingDetailIds: weekFill.revokingDetailIds,
    expandedDates: weekFill.expandedDates,
    dayForms: weekFill.dayForms,
    editableDates: weekFill.editableDates,
    rowsByDate: weekFill.rowsByDate,
    rowErrors: weekFill.rowErrors,
    pendingCount: weekFill.pendingCount,
    pendingHours: weekFill.pendingHours,
    canSubmitWeek: weekFill.canSubmit,
    initializeWeekFill: weekFill.initializeWeek,
    addWeekFillRow: weekFill.addRow,
    duplicateWeekFillRow: weekFill.duplicateRow,
    removeWeekFillRow: weekFill.removeRow,
    setWeekFillRowProject: weekFill.setRowProject,
    setWeekFillRowWorkType: weekFill.setRowWorkType,
    setWeekFillRowHours: weekFill.setRowHours,
    setWeekFillRowContent: weekFill.setRowContent,
    generateWeekFillForDates: weekFill.generateForDates,
    regenerateWeekFillRow: weekFill.regenerateRow,
    setWeekFillDefaultProject: weekFill.setDefaultProject,
    setWeekFillDefaultWorkType: weekFill.setDefaultWorkType,
    setWeekFillDefaultHours: weekFill.setDefaultHours,
    setWeekTheme: weekFill.setWeekTheme,
    getWeekFillRemainingHours: weekFill.getRemainingHours,
    getWeekFillMaxHoursForRow: weekFill.getMaxHoursForRow,
    revokeWeekFillDetail: weekFill.revokeDetail,
    submitWeekFillRow: weekFill.submitRow,
    toggleWeekFillDate: weekFill.toggleDate,
    submitWeekFill: weekFill.submitAll,
    clearWeekFillSubmitResult: weekFill.clearSubmitResult,
    switchWeekAndReset,
    focusCalendarDate,

    // Month calendar
    calendarWeeks: monthCalendar.weeks,
    calendarMonthLabel: monthCalendar.monthLabel,
    isCalendarLoading: monthCalendar.isLoading,
    calendarErrorMessage: monthCalendar.errorMessage,
    loadMonthCalendar: monthCalendar.load,
    shiftCalendarMonth: monthCalendar.shiftMonthBy,
    goCalendarMonth: monthCalendar.goToMonth,

    // Auto fill
    autoFillConfig: autoFill.config,
    autoFillStatus: autoFill.status,
    autoFillExecutionText,
    isAutoFillLoading: autoFill.isLoading,
    loadAutoFill: autoFill.initialize,
    autoWorkTypes: autoFill.workTypes,
    autoProjectId: autoFill.projectId,
    autoWorkTypeGroupId: autoFill.workTypeGroupId,
    autoItemId: autoFill.itemId,
    autoHours: autoFill.hours,
    autoWork: autoFill.work,
    autoReportTime: autoFill.reportTime,
    autoDeadline: autoFill.deadline,
    autoWorkTypeGroups: autoFill.workTypeGroups,
    autoAvailableWorkTypes: autoFill.availableWorkTypes,
    autoOverviewItems: autoFill.overviewItems,
    isAutoFillSaving: autoFill.isSaving,
    isAutoFillTriggering: autoFill.isTriggering,
    isAutoFillDisabling: autoFill.isDisabling,
    openAutoFillSettings: autoFill.open,
    isAutoFillDialogOpen,
    openAutoFillDialog,
    closeAutoFillDialog,
    setAutoProject: autoFill.setProject,
    setAutoWorkTypeGroup: autoFill.setWorkTypeGroup,
    setAutoItem: autoFill.setItem,
    setAutoHours: autoFill.setHours,
    setAutoWork: autoFill.setWork,
    setAutoReportTime: autoFill.setReportTime,
    setAutoDeadline: autoFill.setDeadline,
    saveAutoFillConfig: autoFill.saveConfig,
    runAutoFillNow: autoFill.runNow,
    disableAutoFill: autoFill.disable,

    // Common
    initialize,
    refreshWeekBoard,
    ensureProjectsLoaded,
    focusTarget,
  };
});
