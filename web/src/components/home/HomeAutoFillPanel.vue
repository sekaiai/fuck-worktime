<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';

import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import type { AutoFillConfig, AutoFillStatus } from '../../types/auto-fill';
import type { Project, WorkTypeNode } from '../../types/timesheet';
import { buildWorkTypeGroups, findWorkTypeById } from '../../utils/work-types';

const props = defineProps<{
  userId: string | null;
  config: AutoFillConfig | null;
  status: AutoFillStatus;
  projects: Project[];
  isProjectsLoading: boolean;
  isSaving: boolean;
  isDisabling: boolean;
  isTriggering: boolean;
  loadProjects: () => Promise<void>;
  loadWorkTypes: (projectId: string) => Promise<WorkTypeNode[]>;
  saveConfig: (payload: Partial<AutoFillConfig> & { userId: string }) => Promise<{ code: number; msg: string }>;
  disableConfig: (userId: string) => Promise<{ code: number; msg: string }>;
  triggerConfig: (userId: string) => Promise<{ code: number; msg: string }>;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const DEFAULT_REPORT_TIME = '17:00';

const isOpen = shallowRef(false);
const workTypes = shallowRef<WorkTypeNode[]>([]);
const projectId = shallowRef('');
const workTypeGroupId = shallowRef('');
const itemId = shallowRef('');
const itemName = shallowRef('');
const hours = shallowRef(8);
const work = shallowRef('');
const reportTime = shallowRef(DEFAULT_REPORT_TIME);
const deadline = shallowRef('');
const toastMessage = shallowRef('');
const resultDialog = ref<{ open: boolean; title: string; message: string }>({
  open: false,
  title: '',
  message: '',
});

const workTypeGroups = computed(() => buildWorkTypeGroups(workTypes.value));
const availableWorkTypes = computed(
  () => workTypeGroups.value.find((group) => group.id === workTypeGroupId.value)?.children ?? [],
);

watch(
  () => props.config,
  async (config) => {
    if (!config) {
      projectId.value = '';
      workTypeGroupId.value = '';
      itemId.value = '';
      itemName.value = '';
      hours.value = 8;
      work.value = '';
      reportTime.value = DEFAULT_REPORT_TIME;
      deadline.value = '';
      workTypes.value = [];
      return;
    }

    projectId.value = config.projectId;
    workTypeGroupId.value = config.workTypeGroupId ?? '';
    itemId.value = config.itemId;
    itemName.value = config.itemName;
    hours.value = config.hours;
    work.value = config.work;
    reportTime.value = config.reportTime || DEFAULT_REPORT_TIME;
    deadline.value = config.deadline ?? '';

    try {
      workTypes.value = await props.loadWorkTypes(config.projectId);
      if (!workTypeGroupId.value) {
        workTypeGroupId.value =
          workTypeGroups.value.find((group) => group.children.some((child) => child.id === config.itemId))?.id ?? '';
      }
    } catch {
      workTypes.value = [];
      workTypeGroupId.value = '';
    }
  },
  { immediate: true },
);

function showToast(message: string): void {
  toastMessage.value = message;
  window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
  (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 2600);
}

function closeResultDialog(): void {
  resultDialog.value = { ...resultDialog.value, open: false };
}

async function toggleOpen(): Promise<void> {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) {
    return;
  }

  try {
    await props.loadProjects();
    if (projectId.value) {
      workTypes.value = await props.loadWorkTypes(projectId.value);
      if (itemId.value) {
        workTypeGroupId.value =
          workTypeGroups.value.find((group) => group.children.some((child) => child.id === itemId.value))?.id ?? '';
      }
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Failed to load projects or work types.');
  }
}

async function handleProjectChange(nextProjectId: string): Promise<void> {
  projectId.value = nextProjectId;
  workTypeGroupId.value = '';
  itemId.value = '';
  itemName.value = '';

  try {
    workTypes.value = await props.loadWorkTypes(nextProjectId);
  } catch (error) {
    workTypes.value = [];
    showToast(error instanceof Error ? error.message : 'Failed to load work types.');
  }
}

function handleWorkTypeGroupChange(nextGroupId: string): void {
  workTypeGroupId.value = nextGroupId;
  itemId.value = '';
  itemName.value = '';
}

function handleWorkTypeChange(nextItemId: string): void {
  itemId.value = nextItemId;
  itemName.value = findWorkTypeById(workTypeGroups.value, nextItemId)?.name ?? '';
}

async function handleSave(): Promise<void> {
  if (!props.userId) {
    showToast('Please log in before configuring auto-fill.');
    return;
  }

  if (!projectId.value || !workTypeGroupId.value || !itemId.value) {
    showToast('Project, level-1 type, and level-2 type are required.');
    return;
  }

  if (!Number.isFinite(hours.value) || hours.value <= 0) {
    showToast('Hours must be greater than 0.');
    return;
  }

  if (!work.value.trim()) {
    showToast('Work content is required.');
    return;
  }

  const project = props.projects.find((item) => item.id === projectId.value);
  const workTypeGroup = workTypeGroups.value.find((group) => group.id === workTypeGroupId.value);
  const result = await props.saveConfig({
    userId: props.userId,
    enabled: true,
    projectId: projectId.value,
    projectTitle: project?.title ?? '',
    projectStatus: project?.status ?? 20,
    workTypeGroupId: workTypeGroupId.value,
    workTypeGroupName: workTypeGroup?.name ?? '',
    itemId: itemId.value,
    itemName: itemName.value,
    hours: hours.value,
    work: work.value.trim(),
    reportTime: reportTime.value.trim() || DEFAULT_REPORT_TIME,
    deadline: deadline.value || null,
  });

  resultDialog.value = {
    open: true,
    title: result.code === 200 ? 'Save Result' : 'Save Failed',
    message: result.msg,
  };
  if (result.code === 200) {
    emit('updated');
  }
}

async function handleRunNow(): Promise<void> {
  if (!props.userId) {
    showToast('Please log in before triggering auto-fill.');
    return;
  }

  const result = await props.triggerConfig(props.userId);
  resultDialog.value = {
    open: true,
    title: result.code === 200 ? 'Run Result' : 'Run Failed',
    message: result.msg,
  };
  emit('updated');
}

async function handleDisable(): Promise<void> {
  if (!props.userId) {
    return;
  }

  const result = await props.disableConfig(props.userId);
  resultDialog.value = {
    open: true,
    title: result.code === 200 ? 'Disable Result' : 'Disable Failed',
    message: result.msg,
  };
  if (result.code === 200) {
    emit('updated');
  }
}
</script>

<template>
  <section class="panel">
    <header class="section-header">
      <div>
        <p class="section-eyebrow">Auto Fill</p>
        <h2 class="section-title">Auto Fill Today Timesheet</h2>
        <p class="section-status">
          Status:
          <strong>{{ status === 'enabled' ? 'Enabled' : status === 'expired' ? 'Expired' : 'Disabled' }}</strong>
        </p>
        <p v-if="config?.reportTime" class="section-helper">Report Time: {{ config.reportTime }}</p>
        <p v-if="config?.deadline" class="section-helper">Deadline: {{ config.deadline }}</p>
      </div>
      <button class="action-button" type="button" @click="toggleOpen">
        {{ isOpen ? 'Collapse' : 'Configure' }}
      </button>
    </header>

    <div v-if="isOpen" class="form-grid">
      <label>
        <span>Project</span>
        <select :value="projectId" @change="handleProjectChange(($event.target as HTMLSelectElement).value)">
          <option value="">Select project</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
        </select>
      </label>

      <label>
        <span>Level-1 Type</span>
        <select
          :value="workTypeGroupId"
          :disabled="workTypeGroups.length === 0"
          @change="handleWorkTypeGroupChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select level-1 type</option>
          <option v-for="group in workTypeGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
        </select>
      </label>

      <label>
        <span>Level-2 Type</span>
        <select
          :value="itemId"
          :disabled="availableWorkTypes.length === 0"
          @change="handleWorkTypeChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select level-2 type</option>
          <option v-for="item in availableWorkTypes" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>

      <label>
        <span>Hours</span>
        <input v-model.number="hours" type="number" min="1" max="24" />
      </label>

      <label>
        <span>Report Time</span>
        <input v-model="reportTime" type="time" />
      </label>

      <label>
        <span>Deadline</span>
        <input v-model="deadline" type="date" />
      </label>

      <label class="full">
        <span>Work Content</span>
        <textarea v-model="work" rows="3" placeholder="Describe the work content for auto-fill"></textarea>
      </label>

      <p class="field-helper full">
        If no deadline is set, the scheduler fills the current day at the configured report time on each valid workday.
      </p>
    </div>

    <div v-if="isOpen" class="actions">
      <button class="primary-button" type="button" :disabled="isSaving || isProjectsLoading" @click="handleSave">
        {{ isSaving ? 'Saving...' : 'Save Auto Fill Config' }}
      </button>
      <button
        v-if="status === 'enabled'"
        class="secondary-button"
        type="button"
        :disabled="isTriggering"
        @click="handleRunNow"
      >
        {{ isTriggering ? 'Running...' : 'Run Auto Fill Now' }}
      </button>
      <button
        v-if="status === 'enabled'"
        class="secondary-button"
        type="button"
        :disabled="isDisabling"
        @click="handleDisable"
      >
        {{ isDisabling ? 'Disabling...' : 'Disable Auto Fill' }}
      </button>
    </div>

    <InlineToast :message="toastMessage" />
    <ResultDialog
      :open="resultDialog.open"
      :title="resultDialog.title"
      :message="resultDialog.message"
      @close="closeResultDialog"
    />
  </section>
</template>

<style scoped>
.panel {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  padding: 1.1rem;
  box-shadow: 0 16px 36px rgba(15, 61, 62, 0.08);
  position: relative;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.section-eyebrow {
  margin: 0;
  color: #7c6c54;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.76rem;
}

.section-title {
  margin: 0.25rem 0;
}

.section-status,
.section-helper {
  margin: 0;
  color: #5f645b;
}

.action-button,
.primary-button,
.secondary-button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.action-button {
  background: #ece8df;
}

.primary-button {
  background: #0f4f53;
  color: #fff;
}

.secondary-button {
  background: #ece8df;
  color: #24383f;
}

.form-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.full {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #31454c;
}

.field-helper {
  margin: 0;
  color: #5f645b;
  font-size: 0.88rem;
}

select,
input,
textarea {
  width: 100%;
  border: 1px solid #d6d3cc;
  border-radius: 16px;
  padding: 0.85rem 0.95rem;
  background: #fffdf8;
}

.actions {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (max-width: 680px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
