<script setup lang="ts">
import { computed } from 'vue';
import type { Project, WorkTypeNode } from '../../types/timesheet';
import type { WorkTypeGroup } from '../../utils/work-types';
import { buildWorkTypeGroups } from '../../utils/work-types';

interface Props {
  modelValue: {
    projectId: string;
    workTypeGroupId: string;
    workTypeId: string;
    hours: number;
  };
  projects: Project[];
  workTypes: WorkTypeNode[];
  isLoading?: boolean;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  label: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']];
  'project-change': [projectId: string];
}>();

const workTypeGroups = computed<WorkTypeGroup[]>(() => buildWorkTypeGroups(props.workTypes));

const selectedProject = computed(() => props.projects.find((p) => p.id === props.modelValue.projectId) ?? null);
const selectedWorkTypeGroup = computed(() => workTypeGroups.value.find((g) => g.id === props.modelValue.workTypeGroupId) ?? null);
const selectedWorkType = computed(() => {
  for (const group of workTypeGroups.value) {
    const found = group.children.find((child) => child.id === props.modelValue.workTypeId);
    if (found) return found;
  }
  return null;
});

const availableWorkTypes = computed(() => {
  if (!props.modelValue.workTypeGroupId) return [];
  return workTypeGroups.value.find((g) => g.id === props.modelValue.workTypeGroupId)?.children ?? [];
});

function updateField<K extends keyof Props['modelValue']>(field: K, value: Props['modelValue'][K]) {
  const newValue = { ...props.modelValue, [field]: value };

  if (field === 'projectId') {
    newValue.workTypeGroupId = '';
    newValue.workTypeId = '';
    emit('project-change', value as string);
  }

  if (field === 'workTypeGroupId') {
    newValue.workTypeId = '';
  }

  emit('update:modelValue', newValue);
}
</script>

<template>
  <div class="project-selector">
    <div v-if="label" class="project-selector__label">{{ label }}</div>

    <div class="project-selector__form">
      <div class="project-selector__field">
        <label>
          <span>项目</span>
          <select
            :value="modelValue.projectId"
            :disabled="isLoading"
            @change="updateField('projectId', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.title }}
            </option>
          </select>
        </label>
      </div>

      <div class="project-selector__field">
        <label>
          <span>一级工时类型</span>
          <select
            :value="modelValue.workTypeGroupId"
            :disabled="workTypeGroups.length === 0"
            @change="updateField('workTypeGroupId', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择一级类型</option>
            <option v-for="group in workTypeGroups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </label>
      </div>

      <div class="project-selector__field">
        <label>
          <span>二级工时类型</span>
          <select
            :value="modelValue.workTypeId"
            :disabled="availableWorkTypes.length === 0"
            @change="updateField('workTypeId', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择二级类型</option>
            <option v-for="item in availableWorkTypes" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div class="project-selector__field">
        <label>
          <span>工时</span>
          <input
            :value="modelValue.hours"
            type="number"
            min="1"
            max="24"
            @input="updateField('hours', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </div>
    </div>

    <div v-if="isLoading" class="project-selector__loading">正在加载项目列表...</div>
  </div>
</template>

<style scoped>
.project-selector {
  display: grid;
  gap: 0.8rem;
}

.project-selector__label {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.project-selector__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.project-selector__field label {
  display: grid;
  gap: 0.35rem;
}

.project-selector__field span {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.project-selector__field select,
.project-selector__field input {
  width: 100%;
  border: 1px solid rgba(19, 38, 40, 0.14);
  border-radius: 18px;
  padding: 0.86rem 0.95rem;
  background: rgba(255, 255, 255, 0.72);
  font-size: 1rem;
}

.project-selector__field input:disabled,
.project-selector__field select:disabled {
  color: var(--ink-soft);
  background: rgba(229, 225, 217, 0.9);
}

.project-selector__loading {
  color: var(--ink-soft);
  font-size: 0.88rem;
}

@media (max-width: 960px) {
  .project-selector__form {
    grid-template-columns: 1fr;
  }
}
</style>
