<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { Project, TimesheetEntry, WorkType } from '../../api/timesheet';
import ProjectSelect from './ProjectSelect.vue';
import WorkTypeSelect from './WorkTypeSelect.vue';

interface DateInfo {
  date: string;
  dayOfWeek: string;
  dayName: string;
}

interface EntryData {
  hours: number;
  content: string;
}

interface Props {
  weekDates: DateInfo[];
  projects: Project[];
}

interface Emits {
  (event: 'submit', entries: TimesheetEntry[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedProjectId = ref<string | null>(null);
const selectedWorkTypeId = ref<string | null>(null);
const workTypes = ref<WorkType[]>([]);
const isSubmitting = ref<boolean>(false);

const entryDataMap = reactive<Map<string, EntryData>>(new Map());

props.weekDates.forEach(dateInfo => {
  entryDataMap.set(dateInfo.date, { hours: 8, content: '' });
});

const selectedProject = computed(() => {
  if (!selectedProjectId.value) return null;
  return props.projects.find(p => p.id === selectedProjectId.value) || null;
});

const selectedWorkType = computed(() => {
  if (!selectedWorkTypeId.value) return null;
  const flatten = (items: WorkType[]): WorkType[] => {
    return items.reduce<WorkType[]>((acc, item) => {
      acc.push(item);
      if (item.children) {
        acc.push(...flatten(item.children));
      }
      return acc;
    }, []);
  };
  return flatten(workTypes.value).find(w => w.id === selectedWorkTypeId.value) || null;
});

const canSubmit = computed(() => {
  if (!selectedProject.value || !selectedWorkTypeId.value || isSubmitting.value) {
    return false;
  }
  
  return props.weekDates.some(dateInfo => {
    const data = entryDataMap.get(dateInfo.date);
    return data && data.hours > 0 && data.content.length > 0 && data.content.length <= 200;
  });
});

const handleProjectChange = (project: Project) => {
  selectedProjectId.value = project.id;
  selectedWorkTypeId.value = null;
  workTypes.value = [];
};

const handleWorkTypeChange = (workType: WorkType) => {
  selectedWorkTypeId.value = workType.id;
};

const updateEntryData = (date: string, field: 'hours' | 'content', value: number | string) => {
  const data = entryDataMap.get(date);
  if (data) {
    data[field] = value as never;
  }
};

const getContentLength = (date: string): number => {
  const data = entryDataMap.get(date);
  return data?.content.length || 0;
};

const isContentValid = (date: string): boolean => {
  const data = entryDataMap.get(date);
  return data ? data.content.length > 0 && data.content.length <= 200 : false;
};

const handleSubmit = async () => {
  if (!canSubmit.value || !selectedProject.value || !selectedWorkType.value) {
    return;
  }

  isSubmitting.value = true;

  const entries: TimesheetEntry[] = [];
  
  props.weekDates.forEach(dateInfo => {
    const data = entryDataMap.get(dateInfo.date);
    if (data && data.hours > 0 && data.content.length > 0 && data.content.length <= 200) {
      entries.push({
        reportDate: dateInfo.date,
        projectId: selectedProject.value!.id,
        projectTitle: selectedProject.value!.title,
        itemId: selectedWorkType.value!.id,
        content: data.content,
        hours: data.hours,
      });
    }
  });

  emit('submit', entries);

  setTimeout(() => {
    isSubmitting.value = false;
  }, 500);
};

const resetForm = () => {
  selectedProjectId.value = null;
  selectedWorkTypeId.value = null;
  workTypes.value = [];
  props.weekDates.forEach(dateInfo => {
    entryDataMap.set(dateInfo.date, { hours: 8, content: '' });
  });
};
</script>

<template>
  <div class="timesheet-batch-form">
    <header class="form-header">
      <h3 class="form-title">批量填报工时</h3>
      <p class="form-description">选择项目和工时类型，填写本周各天的工作内容</p>
    </header>

    <div class="form-body">
      <div class="global-settings">
        <div class="form-group">
          <label class="form-label">项目</label>
          <ProjectSelect
            :projects="projects"
            :model-value="selectedProjectId"
            @change="handleProjectChange"
            @update:model-value="selectedProjectId = $event"
          />
        </div>

        <div class="form-group">
          <label class="form-label">工时类型</label>
          <WorkTypeSelect
            :work-types="workTypes"
            :model-value="selectedWorkTypeId"
            @change="handleWorkTypeChange"
            @update:model-value="selectedWorkTypeId = $event"
          />
        </div>
      </div>

      <div class="entries-list">
        <div
          v-for="dateInfo in weekDates"
          :key="dateInfo.date"
          class="entry-card"
        >
          <header class="entry-header">
            <div class="date-info">
              <span class="day-name">{{ dateInfo.dayName }}</span>
              <span class="day-of-week">{{ dateInfo.dayOfWeek }}</span>
            </div>
          </header>

          <div class="entry-body">
            <div class="entry-row">
              <div class="hours-group">
                <label class="inline-label">工时</label>
                <input
                  :value="entryDataMap.get(dateInfo.date)?.hours || 8"
                  class="hours-input"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  @input="updateEntryData(dateInfo.date, 'hours', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
            </div>

            <div class="entry-row">
              <div class="content-group">
                <label class="inline-label">
                  工作内容
                  <span
                    class="char-counter"
                    :class="{ exceeded: getContentLength(dateInfo.date) > 200 }"
                  >
                    {{ getContentLength(dateInfo.date) }}/200
                  </span>
                </label>
                <textarea
                  :value="entryDataMap.get(dateInfo.date)?.content || ''"
                  class="content-input"
                  rows="2"
                  maxlength="200"
                  placeholder="请输入工作内容"
                  @input="updateEntryData(dateInfo.date, 'content', ($event.target as HTMLTextAreaElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button
          class="submit-button"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ isSubmitting ? '提交中...' : '批量提交' }}
        </button>
        <button class="reset-button" @click="resetForm">
          重置
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timesheet-batch-form {
  border: 1px solid rgba(20, 88, 72, 0.14);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at top right, rgba(255, 224, 191, 0.72), transparent 32%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.94), rgba(237, 245, 241, 0.92));
  padding: 1rem;
  box-shadow: 0 20px 40px rgba(39, 78, 70, 0.08);
}

.form-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(20, 88, 72, 0.12);
}

.form-title {
  margin: 0;
  color: #14362f;
  font-size: 1.35rem;
  font-weight: 700;
}

.form-description {
  margin: 0.35rem 0 0;
  color: #587169;
  font-size: 0.85rem;
}

.form-body {
  display: grid;
  gap: 1rem;
}

.global-settings {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(20, 88, 72, 0.12);
}

.form-group {
  display: grid;
  gap: 0.45rem;
}

.form-label {
  color: #21443d;
  font-size: 0.84rem;
  font-weight: 700;
}

.entries-list {
  display: grid;
  gap: 0.75rem;
}

.entry-card {
  border: 1px solid rgba(20, 88, 72, 0.12);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.75);
  padding: 0.85rem;
  transition: box-shadow 0.2s ease;
}

.entry-card:hover {
  box-shadow: 0 4px 12px rgba(39, 78, 70, 0.08);
}

.entry-header {
  margin-bottom: 0.65rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(20, 88, 72, 0.08);
}

.date-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.day-name {
  color: #14362f;
  font-size: 1.1rem;
  font-weight: 600;
}

.day-of-week {
  color: #587169;
  font-size: 0.8rem;
}

.entry-body {
  display: grid;
  gap: 0.65rem;
}

.entry-row {
  display: grid;
  gap: 0.5rem;
}

.hours-group,
.content-group {
  display: grid;
  gap: 0.35rem;
}

.inline-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #21443d;
  font-size: 0.78rem;
  font-weight: 600;
}

.char-counter {
  font-size: 0.7rem;
  font-weight: 400;
  color: #8a9f98;
}

.char-counter.exceeded {
  color: #a34a3f;
  font-weight: 600;
}

.hours-input {
  width: 100%;
  max-width: 8rem;
  border: 1px solid #c9d8d2;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.65rem 0.85rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.hours-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 3px rgba(45, 125, 103, 0.12);
}

.content-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.65rem 0.85rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  resize: vertical;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
}

.content-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 3px rgba(45, 125, 103, 0.12);
}

.content-input::placeholder {
  color: #8a9f98;
}

.form-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.submit-button {
  border-radius: 0.85rem;
  padding: 0.82rem 1rem;
  border: none;
  background: linear-gradient(135deg, #145848, #267360);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(20, 88, 72, 0.16);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  cursor: pointer;
}

.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.submit-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.reset-button {
  border-radius: 0.85rem;
  padding: 0.82rem 1.25rem;
  border: 1px solid #c9d8d2;
  background: rgba(255, 255, 255, 0.92);
  color: #21443d;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    background 0.2s ease;
  cursor: pointer;
}

.reset-button:hover {
  transform: translateY(-1px);
  background: rgba(247, 251, 249, 0.95);
}

@media (min-width: 768px) {
  .global-settings {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
