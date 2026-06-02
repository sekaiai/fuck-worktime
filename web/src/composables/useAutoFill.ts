import { computed, shallowRef } from 'vue';

import { ApiError } from '../api/request';
import { disableAutoFill, getAutoFillConfig, runAutoFillNow, saveAutoFillConfig } from '../api/timesheet-client';
import type { Project, WorkTypeNode } from '../types/timesheet';
import type { AutoFillConfig, AutoFillStatus } from '../types/auto-fill';
import { getTodayKey } from '../utils/date';
import type { WorkTypeGroup } from '../utils/work-types';

const DEFAULT_REPORT_TIME = '17:00';

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

export function useAutoFill(options: {
  projects: () => Project[];
  getWorkTypeGroups: (workTypes: WorkTypeNode[]) => WorkTypeGroup[];
  findWorkType: (groups: WorkTypeGroup[], itemId: string) => WorkTypeNode | null;
  loadWorkTypesByProject: (projectId: string) => Promise<WorkTypeNode[]>;
  loadAutoFillConfig: (userId: string) => Promise<AutoFillConfig | null>;
  getUserId: () => string | null;
  showToast: (msg: string) => void;
}) {
  const { projects, getWorkTypeGroups, findWorkType, loadWorkTypesByProject, loadAutoFillConfig, getUserId, showToast } = options;

  const config = shallowRef<AutoFillConfig | null>(null);
  const isLoading = shallowRef(false);
  const isSaving = shallowRef(false);
  const isDisabling = shallowRef(false);
  const isTriggering = shallowRef(false);
  const isOpen = shallowRef(false);
  const workTypes = shallowRef<WorkTypeNode[]>([]);
  const projectId = shallowRef('');
  const workTypeGroupId = shallowRef('');
  const itemId = shallowRef('');
  const hours = shallowRef(8);
  const work = shallowRef('');
  const reportTime = shallowRef(DEFAULT_REPORT_TIME);
  const deadline = shallowRef('');
  const resultDialog = shallowRef<ResultDialogState>(createDialogState());

  const status = computed<AutoFillStatus>(() => {
    if (!config.value?.enabled) {
      return 'disabled';
    }

    if (config.value.expired || (config.value.deadline && config.value.deadline < getTodayKey())) {
      return 'expired';
    }

    return 'enabled';
  });

  const workTypeGroups = computed(() => getWorkTypeGroups(workTypes.value));
  const selectedProject = computed(() => projects().find((p) => p.id === projectId.value) ?? null);
  const selectedWorkTypeGroup = computed(() => workTypeGroups.value.find((g) => g.id === workTypeGroupId.value) ?? null);
  const selectedWorkType = computed(() => findWorkType(workTypeGroups.value, itemId.value));
  const availableWorkTypes = computed(() => workTypeGroups.value.find((g) => g.id === workTypeGroupId.value)?.children ?? []);

  const overviewItems = computed(() => {
    if (!config.value) {
      return [];
    }

    return [
      { label: '项目', value: config.value.projectTitle || '未配置' },
      { label: '工时类型', value: config.value.itemName || '未配置' },
      { label: '填报时间', value: config.value.reportTime || DEFAULT_REPORT_TIME },
      { label: '截止日期', value: config.value.deadline || '长期有效' },
    ];
  });

  function resetForm(): void {
    projectId.value = '';
    workTypeGroupId.value = '';
    itemId.value = '';
    hours.value = 8;
    work.value = '';
    reportTime.value = DEFAULT_REPORT_TIME;
    deadline.value = '';
    workTypes.value = [];
  }

  function syncAutoWorkTypeGroup(nextItemId = itemId.value): void {
    if (!nextItemId || workTypeGroupId.value) {
      return;
    }

    workTypeGroupId.value = workTypeGroups.value.find((g) => g.children.some((c) => c.id === nextItemId))?.id ?? '';
  }

  function syncFormFromConfig(nextConfig: AutoFillConfig | null): void {
    if (!nextConfig) {
      resetForm();
      return;
    }

    projectId.value = nextConfig.projectId;
    workTypeGroupId.value = nextConfig.workTypeGroupId ?? '';
    itemId.value = nextConfig.itemId;
    hours.value = nextConfig.hours;
    work.value = nextConfig.work;
    reportTime.value = nextConfig.reportTime || DEFAULT_REPORT_TIME;
    deadline.value = nextConfig.deadline ?? '';
  }

  async function initialize(userId: string): Promise<void> {
    isLoading.value = true;
    try {
      const loadedConfig = await loadAutoFillConfig(userId);
      config.value = loadedConfig;
      syncFormFromConfig(loadedConfig);
      if (loadedConfig?.projectId) {
        workTypes.value = await loadWorkTypesByProject(loadedConfig.projectId);
        syncAutoWorkTypeGroup(loadedConfig.itemId);
      }
    } catch {
      config.value = null;
      resetForm();
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleOpen(): Promise<void> {
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      return;
    }

    try {
      if (projectId.value) {
        workTypes.value = await loadWorkTypesByProject(projectId.value);
        syncAutoWorkTypeGroup();
      }
    } catch (error) {
      showToast(getErrorMessage(error, '加载项目或工时类型失败。'));
    }
  }

  async function setProject(nextProjectId: string): Promise<void> {
    projectId.value = nextProjectId;
    workTypeGroupId.value = '';
    itemId.value = '';
    if (nextProjectId) {
      workTypes.value = await loadWorkTypesByProject(nextProjectId);
    } else {
      workTypes.value = [];
    }
  }

  function setWorkTypeGroup(nextGroupId: string): void {
    workTypeGroupId.value = nextGroupId;
    itemId.value = '';
  }

  function setItem(nextItemId: string): void {
    itemId.value = nextItemId;
  }

  function setHours(nextValue: number): void {
    hours.value = nextValue;
  }

  function setWork(nextValue: string): void {
    work.value = nextValue;
  }

  function setReportTime(nextValue: string): void {
    reportTime.value = nextValue;
  }

  function setDeadline(nextValue: string): void {
    deadline.value = nextValue;
  }

  async function saveConfig(): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      showToast('请先登录后再配置自动填报。');
      return;
    }

    if (!projectId.value || !workTypeGroupId.value || !itemId.value) {
      showToast('项目、一级工时类型和二级工时类型为必填项。');
      return;
    }

    if (!Number.isFinite(hours.value) || hours.value <= 0) {
      showToast('工时必须大于 0。');
      return;
    }

    if (!work.value.trim()) {
      showToast('工作内容为必填项。');
      return;
    }

    if (!selectedProject.value || !selectedWorkTypeGroup.value || !selectedWorkType.value) {
      showToast('请选择有效的项目和工时类型。');
      return;
    }

    isSaving.value = true;
    try {
      const result = await saveAutoFillConfig({
        userId,
        enabled: true,
        projectId: projectId.value,
        projectTitle: selectedProject.value.title,
        projectStatus: selectedProject.value.projectStatus,
        workTypeGroupId: workTypeGroupId.value,
        workTypeGroupName: selectedWorkTypeGroup.value.name,
        itemId: itemId.value,
        itemName: selectedWorkType.value.name,
        hours: hours.value,
        work: work.value.trim(),
        reportTime: reportTime.value.trim() || DEFAULT_REPORT_TIME,
        deadline: deadline.value || null,
      });

      resultDialog.value = {
        open: true,
        title: result.code === 200 ? '保存成功' : '保存失败',
        message: result.msg,
      };
      if (result.code === 200) {
        const reloadedConfig = await loadAutoFillConfig(userId);
        config.value = reloadedConfig;
        syncFormFromConfig(reloadedConfig);
      }
    } catch (error) {
      resultDialog.value = {
        open: true,
        title: '保存失败',
        message: getErrorMessage(error, '保存自动填报失败'),
      };
    } finally {
      isSaving.value = false;
    }
  }

  async function runNow(): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      showToast('请先登录再执行自动填报。');
      return;
    }

    isTriggering.value = true;
    try {
      const result = await runAutoFillNow(userId);
      resultDialog.value = {
        open: true,
        title: result.code === 200 ? '执行成功' : '执行失败',
        message: result.msg,
      };
      const reloadedConfig = await loadAutoFillConfig(userId);
      config.value = reloadedConfig;
      syncFormFromConfig(reloadedConfig);
    } catch (error) {
      resultDialog.value = {
        open: true,
        title: '执行失败',
        message: getErrorMessage(error, '立即执行自动填报失败'),
      };
    } finally {
      isTriggering.value = false;
    }
  }

  async function disable(): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      return;
    }

    isDisabling.value = true;
    try {
      const result = await disableAutoFill(userId);
      resultDialog.value = {
        open: true,
        title: result.code === 200 ? '禁用成功' : '禁用失败',
        message: result.msg,
      };
      if (result.code === 200) {
        const reloadedConfig = await loadAutoFillConfig(userId);
        config.value = reloadedConfig;
        syncFormFromConfig(reloadedConfig);
      }
    } catch (error) {
      resultDialog.value = {
        open: true,
        title: '禁用失败',
        message: getErrorMessage(error, '关闭自动填报失败'),
      };
    } finally {
      isDisabling.value = false;
    }
  }

  function closeResultDialog(): void {
    resultDialog.value = { ...resultDialog.value, open: false };
  }

  return {
    config,
    isLoading,
    isSaving,
    isDisabling,
    isTriggering,
    isOpen,
    workTypes,
    projectId,
    workTypeGroupId,
    itemId,
    hours,
    work,
    reportTime,
    deadline,
    resultDialog,
    status,
    workTypeGroups,
    selectedProject,
    selectedWorkTypeGroup,
    selectedWorkType,
    availableWorkTypes,
    overviewItems,
    initialize,
    toggleOpen,
    setProject,
    setWorkTypeGroup,
    setItem,
    setHours,
    setWork,
    setReportTime,
    setDeadline,
    saveConfig,
    runNow,
    disable,
    closeResultDialog,
  };
}
