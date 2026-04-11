import { ref, computed, type Ref } from 'vue';
import { getProjects, getWorkTypes, generateContent, submitBatch } from '../api/timesheet';
import { getCache, setCache, getProjectsCacheKey, getWorkTypesCacheKey } from '../utils/cache';
import type { Project, WorkTypeNode, TimesheetEntry, WeekDay } from '../types/timesheet';

export function useTimesheetForm(userId: Ref<string | null>) {
  const projects = ref<Project[]>([]);
  const workTypes = ref<WorkTypeNode[]>([]);
  const selectedProject = ref<Project | null>(null);
  const selectedWorkType = ref<WorkTypeNode | null>(null);
  const hours = ref(8);
  const workContent = ref('');
  const fillDays = ref(0);
  const maxFillDays = ref(0);

  const entries = ref<TimesheetEntry[]>([]);
  const entryDates = ref<string[]>([]);

  const isLoadingProjects = ref(false);
  const isLoadingWorkTypes = ref(false);
  const isGenerating = ref(false);
  const isSubmitting = ref(false);

  async function loadProjects(): Promise<void> {
    if (!userId.value) return;
    const cacheKey = getProjectsCacheKey(userId.value);
    const cached = getCache<Project[]>(cacheKey);
    if (cached) {
      projects.value = cached;
      return;
    }

    isLoadingProjects.value = true;
    try {
      const data = await getProjects();
      projects.value = data;
      setCache(cacheKey, data);
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function loadWorkTypes(projectId: string): Promise<void> {
    const cacheKey = getWorkTypesCacheKey(projectId);
    const cached = getCache<WorkTypeNode[]>(cacheKey);
    if (cached) {
      workTypes.value = cached;
      return;
    }

    isLoadingWorkTypes.value = true;
    try {
      const data = await getWorkTypes(projectId);
      workTypes.value = data;
      setCache(cacheKey, data);
    } finally {
      isLoadingWorkTypes.value = false;
    }
  }

  function initForm(fillableDays: WeekDay[]): void {
    maxFillDays.value = fillableDays.length;
    fillDays.value = fillableDays.length;
    entryDates.value = fillableDays.map((d) => d.date);
    entries.value = [];
  }

  function selectProject(project: Project): void {
    selectedProject.value = project;
    selectedWorkType.value = null;
    loadWorkTypes(project.id);
  }

  function selectWorkType(workType: WorkTypeNode): void {
    selectedWorkType.value = workType;
  }

  function getFlatWorkTypes(): Array<{ node: WorkTypeNode; parent: string }> {
    const result: Array<{ node: WorkTypeNode; parent: string }> = [];
    for (const parent of workTypes.value) {
      if (parent.children && parent.children.length > 0) {
        for (const child of parent.children) {
          result.push({ node: child, parent: parent.name });
        }
      } else {
        result.push({ node: parent, parent: '' });
      }
    }
    return result;
  }

  function getDefaultWorkType(): WorkTypeNode | null {
    for (const parent of workTypes.value) {
      if (parent.children) {
        for (const child of parent.children) {
          if (child.extraFields?.selected) return child;
        }
      }
      if (parent.extraFields?.selected) return parent;
    }
    return null;
  }

  async function generate(fillableDays: WeekDay[]): Promise<void> {
    if (!selectedProject.value || !selectedWorkType.value) return;
    if (fillDays.value > maxFillDays.value) return;
    if (fillDays.value <= 0) return;

    isGenerating.value = true;
    try {
      const contents = await generateContent(workContent.value, fillDays.value);

      const sortedDays = [...fillableDays].sort((a, b) => a.date.localeCompare(b.date));
      const targetDays = sortedDays.slice(0, fillDays.value);

      entries.value = targetDays.map((day, index) => ({
        reportDate: day.date,
        projectId: selectedProject.value!.id,
        projectTitle: selectedProject.value!.title,
        projectStatus: 20,
        itemId: selectedWorkType.value!.id,
        content: contents[index] || '日常工作处理',
        hours: hours.value,
      }));

      entryDates.value = targetDays.map((d) => d.date);
    } finally {
      isGenerating.value = false;
    }
  }

  function updateEntry(index: number, field: keyof TimesheetEntry, value: string | number): void {
    if (index >= 0 && index < entries.value.length) {
      (entries.value[index] as Record<string, string | number>)[field] = value;
    }
  }

  function validateDateChange(newDate: string, fillableDates: string[]): boolean {
    return fillableDates.includes(newDate);
  }

  async function submit(): Promise<{ success: boolean; message: string }> {
    if (entries.value.length === 0) {
      return { success: false, message: '没有可提交的工时数据' };
    }

    isSubmitting.value = true;
    try {
      const result = await submitBatch({ workingTimingList: entries.value });
      return { success: result.code === 200, message: result.msg || '提交完成' };
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      return { success: false, message };
    } finally {
      isSubmitting.value = false;
    }
  }

  function reset(): void {
    entries.value = [];
    entryDates.value = [];
    workContent.value = '';
    hours.value = 8;
  }

  return {
    projects,
    workTypes,
    selectedProject,
    selectedWorkType,
    hours,
    workContent,
    fillDays,
    maxFillDays,
    entries,
    entryDates,
    isLoadingProjects,
    isLoadingWorkTypes,
    isGenerating,
    isSubmitting,
    loadProjects,
    loadWorkTypes,
    initForm,
    selectProject,
    selectWorkType,
    getFlatWorkTypes,
    getDefaultWorkType,
    generate,
    updateEntry,
    validateDateChange,
    submit,
    reset,
  };
}
