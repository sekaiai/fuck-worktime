<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Project, TimesheetEntry, WorkType } from '../../api/timesheet';
import ProjectSelect from './ProjectSelect.vue';
import WorkTypeSelect from './WorkTypeSelect.vue';

interface DateInfo {
  date: string;
  dayOfWeek: string;
  dayName: string;
}

interface Props {
  dateInfo: DateInfo;
  projects: Project[];
  workTypes: WorkType[];
}

interface Emits {
  (event: 'submit', entry: TimesheetEntry): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedProjectId = ref<string | null>(null);
const selectedWorkTypeId = ref<string | null>(null);
const hours = ref<number>(8);
const content = ref<string>('');
const isSubmitting = ref<boolean>(false);

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
  return flatten(props.workTypes).find(w => w.id === selectedWorkTypeId.value) || null;
});

const contentLength = computed(() => content.value.length);
const isContentValid = computed(() => content.value.length > 0 && content.value.length <= 200);
const canSubmit = computed(() => {
  return (
    selectedProject.value &&
    selectedWorkType.value &&
    hours.value > 0 &&
    isContentValid.value &&
    !isSubmitting.value
  );
});

const handleProjectChange = (project: Project) => {
  selectedProjectId.value = project.id;
  selectedWorkTypeId.value = null;
};

const handleWorkTypeChange = (workType: WorkType) => {
  selectedWorkTypeId.value = workType.id;
};

const handleSubmit = async () => {
  if (!canSubmit.value || !selectedProject.value || !selectedWorkType.value) {
    return;
  }

  isSubmitting.value = true;

  const entry: TimesheetEntry = {
    reportDate: props.dateInfo.date,
    projectId: selectedProject.value.id,
    projectTitle: selectedProject.value.title,
    itemId: selectedWorkType.value.id,
    content: content.value,
    hours: hours.value,
  };

  emit('submit', entry);

  setTimeout(() => {
    isSubmitting.value = false;
  }, 500);
};

const resetForm = () => {
  selectedProjectId.value = null;
  selectedWorkTypeId.value = null;
  hours.value = 8;
  content.value = '';
};
</script>

<template>
  <div class="timesheet-entry-form">
    <header class="form-header">
      <div class="date-info">
        <span class="day-name">{{ dateInfo.dayName }}</span>
        <span class="day-of-week">{{ dateInfo.dayOfWeek }}</span>
      </div>
    </header>

    <div class="form-body">
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
          :disabled="!selectedProjectId"
          @change="handleWorkTypeChange"
          @update:model-value="selectedWorkTypeId = $event"
        />
      </div>

      <div class="form-group">
        <label class="form-label">工时（小时）</label>
        <input
          v-model.number="hours"
          class="hours-input"
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          placeholder="请输入工时"
        />
      </div>

      <div class="form-group">
        <label class="form-label">
          工作内容
          <span class="char-counter" :class="{ exceeded: contentLength > 200 }">
            {{ contentLength }}/200
          </span>
        </label>
        <textarea
          v-model="content"
          class="content-input"
          rows="3"
          maxlength="200"
          placeholder="请输入工作内容（最多200字）"
        />
      </div>

      <div class="form-actions">
        <button
          class="submit-button"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ isSubmitting ? '提交中...' : '提交' }}
        </button>
        <button class="reset-button" @click="resetForm">
          重置
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timesheet-entry-form {
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

.date-info {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.day-name {
  color: #14362f;
  font-size: 1.35rem;
  font-weight: 700;
}

.day-of-week {
  color: #587169;
  font-size: 0.9rem;
}

.form-body {
  display: grid;
  gap: 1rem;
}

.form-group {
  display: grid;
  gap: 0.45rem;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #21443d;
  font-size: 0.84rem;
  font-weight: 700;
}

.char-counter {
  font-size: 0.75rem;
  font-weight: 400;
  color: #8a9f98;
}

.char-counter.exceeded {
  color: #a34a3f;
  font-weight: 600;
}

.hours-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.hours-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
}

.content-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  resize: vertical;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.6;
}

.content-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
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
</style>
