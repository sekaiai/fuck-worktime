import { computed, shallowRef } from 'vue';

import { getErrorMessage } from '../api/request';
import { disableAutoFill, getAutoFillConfig, runAutoFillNow, saveAutoFillConfig } from '../api/timesheet-client';
import type { Project, WorkTypeNode } from '../types/timesheet';
import type { AutoFillConfig, AutoFillStatus } from '../types/auto-fill';
import { getTodayKey } from '../utils/date';
import { waitForRemoteRefresh } from '../utils/remote-refresh';
import type { WorkTypeGroup } from '../utils/work-types';
import type { ToastType } from './useToast';

const DEFAULT_REPORT_TIME = '17:00';

export function useAutoFill(options: {
  projects: () => Project[];
  getWorkTypeGroups: (workTypes: WorkTypeNode[]) => WorkTypeGroup[];
  findWorkType: (groups: WorkTypeGroup[], itemId: string) => WorkTypeNode | null;
  loadWorkTypesByProject: (projectId: string) => Promise<WorkTypeNode[]>;
  loadAutoFillConfig: (userId: string) => Promise<AutoFillConfig | null>;
  getUserId: () => string | null;
  showToast: (msg: string, type?: ToastType) => void;
}) {
  const { projects, getWorkTypeGroups, findWorkType, loadWorkTypesByProject, loadAutoFillConfig, getUserId, showToast } = options;

  const config = shallowRef<AutoFillConfig | null>(null);
  const isLoading = shallowRef(false);
  const isSaving = shallowRef(false);
  const isDisabling = shallowRef(false);
  const isTriggering = shallowRef(false);
  const workTypes = shallowRef<WorkTypeNode[]>([]);
  const projectId = shallowRef('');
  const workTypeGroupId = shallowRef('');
  const itemId = shallowRef('');
  const hours = shallowRef(8);
  const work = shallowRef('');
  const reportTime = shallowRef(DEFAULT_REPORT_TIME);
  const deadline = shallowRef('');

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

  async function reloadConfigAfterRemoteUpdate(userId: string): Promise<void> {
    await waitForRemoteRefresh();
    const reloadedConfig = await loadAutoFillConfig(userId);
    config.value = reloadedConfig;
    syncFormFromConfig(reloadedConfig);
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

  async function open(): Promise<boolean> {
    if (!projectId.value) {
      return true;
    }

    try {
      workTypes.value = await loadWorkTypesByProject(projectId.value);
      syncAutoWorkTypeGroup();
      return true;
    } catch (error) {
      showToast(getErrorMessage(error, '加载项目或工时类型失败。'), 'error');
      return false;
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
      showToast('请先登录后再配置自动填报。', 'error');
      return;
    }

    if (!projectId.value || !workTypeGroupId.value || !itemId.value) {
      showToast('项目、一级工时类型和二级工时类型为必填项。', 'error');
      return;
    }

    if (!Number.isFinite(hours.value) || hours.value <= 0) {
      showToast('工时必须大于 0。', 'error');
      return;
    }

    if (!work.value.trim()) {
      showToast('工作内容为必填项。', 'error');
      return;
    }

    if (!selectedProject.value || !selectedWorkTypeGroup.value || !selectedWorkType.value) {
      showToast('请选择有效的项目和工时类型。', 'error');
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

      if (result.code === 200) {
        showToast(result.msg || '保存成功', 'success');
        await reloadConfigAfterRemoteUpdate(userId);
      } else {
        showToast(result.msg || '保存失败', 'error');
      }
    } catch (error) {
      showToast(getErrorMessage(error, '保存自动填报失败'), 'error');
    } finally {
      isSaving.value = false;
    }
  }

  async function runNow(): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      showToast('请先登录再执行自动填报。', 'error');
      return;
    }

    isTriggering.value = true;
    try {
      const result = await runAutoFillNow(userId);
      if (result.code === 200) {
        showToast(result.msg || '执行成功', 'success');
        await reloadConfigAfterRemoteUpdate(userId);
      } else {
        showToast(result.msg || '执行失败', 'error');
      }
    } catch (error) {
      showToast(getErrorMessage(error, '立即执行自动填报失败'), 'error');
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
      if (result.code === 200) {
        showToast(result.msg || '禁用成功', 'success');
        await reloadConfigAfterRemoteUpdate(userId);
      } else {
        showToast(result.msg || '禁用失败', 'error');
      }
    } catch (error) {
      showToast(getErrorMessage(error, '关闭自动填报失败'), 'error');
    } finally {
      isDisabling.value = false;
    }
  }

  return {
    config,
    isLoading,
    isSaving,
    isDisabling,
    isTriggering,
    workTypes,
    projectId,
    workTypeGroupId,
    itemId,
    hours,
    work,
    reportTime,
    deadline,
    status,
    workTypeGroups,
    selectedProject,
    selectedWorkTypeGroup,
    selectedWorkType,
    availableWorkTypes,
    overviewItems,
    initialize,
    open,
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
  };
}
