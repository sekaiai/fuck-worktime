import { computed, ref, shallowRef } from 'vue';
import {
  getProjects,
  getWorkTypes,
  submitTimesheet,
  generateContent,
  getGzdataToken,
  type Project,
  type WorkType,
  type TimesheetEntry,
} from '../api/timesheet';

function getWeekDates(): { date: string; dayOfWeek: string; dayName: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const result = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    result.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: days[i],
      dayName: `${date.getMonth() + 1}/${date.getDate()}`,
    });
  }
  
  return result;
}

export function useTimesheet() {
  const projects = shallowRef<Project[]>([]);
  const workTypes = shallowRef<WorkType[]>([]);
  const selectedProject = shallowRef<Project | null>(null);
  const selectedWorkType = shallowRef<WorkType | null>(null);
  const weekDates = getWeekDates();
  
  const isLoadingProjects = ref(false);
  const isLoadingWorkTypes = ref(false);
  const isSubmitting = ref(false);
  const isGenerating = ref(false);
  
  const error = ref<string | null>(null);
  const submitResults = shallowRef<{ date: string; success: boolean; message: string }[]>([]);

  const hasToken = computed(() => !!getGzdataToken());
  const flattenedWorkTypes = computed(() => {
    const result: WorkType[] = [];
    function flatten(items: WorkType[]) {
      for (const item of items) {
        result.push(item);
        if (item.children) {
          flatten(item.children);
        }
      }
    }
    flatten(workTypes.value);
    return result;
  });

  async function loadProjects() {
    if (!hasToken.value) {
      error.value = '请先设置 Token';
      return;
    }
    
    isLoadingProjects.value = true;
    error.value = null;
    
    try {
      projects.value = await getProjects();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载项目列表失败';
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function loadWorkTypes(projectId: string) {
    if (!projectId) return;
    
    isLoadingWorkTypes.value = true;
    error.value = null;
    
    try {
      workTypes.value = await getWorkTypes(projectId);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载工时类型失败';
    } finally {
      isLoadingWorkTypes.value = false;
    }
  }

  function selectProject(project: Project | null) {
    selectedProject.value = project;
    selectedWorkType.value = null;
    workTypes.value = [];
    if (project) {
      loadWorkTypes(project.id);
    }
  }

  function selectWorkType(workType: WorkType | null) {
    selectedWorkType.value = workType;
  }

  async function submit(entry: TimesheetEntry): Promise<boolean> {
    isSubmitting.value = true;
    error.value = null;
    
    try {
      const result = await submitTimesheet(entry);
      return result.success;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '提交失败';
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function submitBatch(
    entries: TimesheetEntry[]
  ): Promise<{ date: string; success: boolean; message: string }[]> {
    submitResults.value = [];
    
    for (const entry of entries) {
      const success = await submit(entry);
      submitResults.value = [
        ...submitResults.value,
        { date: entry.reportDate, success, message: success ? '成功' : '失败' },
      ];
    }
    
    return submitResults.value;
  }

  async function generate(
    dayCount: number,
    description: string,
    maxChars: number = 200
  ): Promise<string[]> {
    isGenerating.value = true;
    error.value = null;
    
    try {
      return await generateContent({ dayCount, maxChars, description });
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'AI 生成失败';
      return [];
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    projects,
    workTypes,
    selectedProject,
    selectedWorkType,
    weekDates,
    isLoadingProjects,
    isLoadingWorkTypes,
    isSubmitting,
    isGenerating,
    error,
    submitResults,
    
    hasToken,
    flattenedWorkTypes,
    
    loadProjects,
    loadWorkTypes,
    selectProject,
    selectWorkType,
    submit,
    submitBatch,
    generate,
  };
}
