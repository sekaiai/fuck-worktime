import { defineStore, storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useAuthStore } from './auth';
import { useWeekBoard } from '../composables/useWeekBoard';
import { useProjectCatalog } from '../composables/useProjectCatalog';
import { useManualFill } from '../composables/useManualFill';
import { useAutoFill } from '../composables/useAutoFill';
import { useWeekFill } from '../composables/useWeekFill';
import { useToast } from '../composables/useToast';
import { getAutoFillConfig } from '../api/timesheet-client';

export const useHomeStore = defineStore('home', () => {
  const authStore = useAuthStore();

  // Create the composables
  const weekBoard = useWeekBoard();
  const projectCatalog = useProjectCatalog();
  const manualToast = useToast();
  const autoToast = useToast();

  // Manual fill composable
  const manualFill = useManualFill({
    fillableDays: () => weekBoard.fillableDays.value,
    projects: () => projectCatalog.projects.value,
    getWorkTypeGroups: projectCatalog.getWorkTypeGroups,
    findWorkType: projectCatalog.findWorkType,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    refreshWeekBoard: async () => {
      await weekBoard.loadWeek();
    },
    showToast: manualToast.show,
  });

  // Auto fill composable
  const autoFill = useAutoFill({
    projects: () => projectCatalog.projects.value,
    getWorkTypeGroups: projectCatalog.getWorkTypeGroups,
    findWorkType: projectCatalog.findWorkType,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    loadAutoFillConfig: getAutoFillConfig,
    getUserId: () => authStore.userId,
    showToast: autoToast.show,
  });

  const weekFill = useWeekFill({
    days: () => weekBoard.days.value,
    projects: () => projectCatalog.projects.value,
    getWorkTypesForProject: projectCatalog.getWorkTypesForProject,
    loadWorkTypesByProject: projectCatalog.loadWorkTypesByProject,
    getAutoFillConfig: () => autoFill.config.value,
    refreshWeekBoard: async () => {
      await weekBoard.loadWeek();
    },
    showToast: manualToast.show,
  });

  // Computed for notification visibility
  const notifyVisible = computed(() => autoFill.status.value === 'enabled');

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

    // 必须在三者都完成后再初始化：依赖 days、projects 与 autoFill.config
    await weekFill.initializeWeek();
  }

  async function refreshWeekBoard(): Promise<void> {
    const ok = await weekBoard.loadWeek();
    if (!ok && weekBoard.errorCode.value === 'TOKEN_EXPIRED') {
      authStore.handleTokenExpired();
    }
  }

  async function switchWeekAndReset(direction: 'previous' | 'current' | 'next'): Promise<void> {
    await weekBoard.switchWeek(direction);
    await weekFill.initializeWeek();
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
    days: weekBoard.days,
    fillableDays: weekBoard.fillableDays,
    totalHours: weekBoard.totalHours,
    workDays: weekBoard.workDays,
    averageHours: weekBoard.averageHours,
    weekTitle: weekBoard.weekTitle,
    weekRange: weekBoard.weekRange,
    isCurrentWeek: weekBoard.isCurrentWeek,
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
    toggleWeekFillDate: weekFill.toggleDate,
    submitWeekFill: weekFill.submitAll,
    switchWeekAndReset,

    // Manual fill
    isManualFillVisible: manualFill.isVisible,
    manualProjectId: manualFill.projectId,
    manualWorkTypeGroupId: manualFill.workTypeGroupId,
    manualWorkTypeId: manualFill.workTypeId,
    manualHours: manualFill.hours,
    manualWork: manualFill.work,
    manualDaysToGenerate: manualFill.daysToGenerate,
    manualEntries: manualFill.entries,
    isGenerating: manualFill.isGenerating,
    isSubmitting: manualFill.isSubmitting,
    manualToastMessage: manualToast.message,
    manualResultDialog: manualFill.resultDialog,
    manualCurrentStep: manualFill.currentStep,
    compactReviewMode: manualFill.compactReviewMode,
    manualMaxFillDays: manualFill.maxFillDays,
    sortedFillableDays: manualFill.sortedFillableDays,
    manualWorkTypeGroups: manualFill.workTypeGroups,
    manualSelectedWorkType: manualFill.selectedWorkType,
    manualAvailableWorkTypes: manualFill.availableWorkTypes,
    manualPreviewDates: manualFill.previewDates,
    openManualFill: manualFill.open,
    closeManualFill: manualFill.close,
    quickFillOneDay: manualFill.quickFillOneDay,
    setManualProject: manualFill.setProject,
    setManualWorkTypeGroup: manualFill.setWorkTypeGroup,
    setManualWorkType: manualFill.setWorkType,
    setManualCurrentStep: manualFill.setCurrentStep,
    setManualHours: manualFill.setHours,
    setManualDaysToGenerate: manualFill.setDaysToGenerate,
    setManualWork: manualFill.setWork,
    setCompactReviewMode: manualFill.setCompactReviewMode,
    generateManualEntries: manualFill.generateEntries,
    updateManualEntryDate: manualFill.updateEntryDate,
    updateManualEntryContent: manualFill.updateEntryContent,
    updateManualEntryHours: manualFill.updateEntryHours,
    submitManualEntries: manualFill.submitEntries,
    closeManualResultDialog: manualFill.closeResultDialog,

    // Auto fill
    autoFillConfig: autoFill.config,
    autoFillStatus: autoFill.status,
    isAutoFillLoading: autoFill.isLoading,
    isSaving: autoFill.isSaving,
    isDisabling: autoFill.isDisabling,
    isTriggering: autoFill.isTriggering,
    autoIsOpen: autoFill.isOpen,
    autoWorkTypes: autoFill.workTypes,
    autoProjectId: autoFill.projectId,
    autoWorkTypeGroupId: autoFill.workTypeGroupId,
    autoItemId: autoFill.itemId,
    autoHours: autoFill.hours,
    autoWork: autoFill.work,
    autoReportTime: autoFill.reportTime,
    autoDeadline: autoFill.deadline,
    autoToastMessage: autoToast.message,
    autoResultDialog: autoFill.resultDialog,
    autoWorkTypeGroups: autoFill.workTypeGroups,
    autoSelectedProject: autoFill.selectedProject,
    autoSelectedWorkTypeGroup: autoFill.selectedWorkTypeGroup,
    autoSelectedWorkType: autoFill.selectedWorkType,
    autoAvailableWorkTypes: autoFill.availableWorkTypes,
    autoOverviewItems: autoFill.overviewItems,
    loadAutoFill: autoFill.initialize,
    toggleAutoFillOpen: autoFill.toggleOpen,
    setAutoProject: autoFill.setProject,
    setAutoWorkTypeGroup: autoFill.setWorkTypeGroup,
    setAutoItem: autoFill.setItem,
    setAutoHours: autoFill.setHours,
    setAutoWork: autoFill.setWork,
    setAutoReportTime: autoFill.setReportTime,
    setAutoDeadline: autoFill.setDeadline,
    saveCurrentAutoFillConfig: autoFill.saveConfig,
    runAutoFillConfigNow: autoFill.runNow,
    disableCurrentAutoFillConfig: autoFill.disable,
    closeAutoResultDialog: autoFill.closeResultDialog,
    notifyVisible,

    // Common
    initialize,
    refreshWeekBoard,
    ensureProjectsLoaded,
  };
});
