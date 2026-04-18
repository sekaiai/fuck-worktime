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
const selectedProject = computed(() => props.projects.find((project) => project.id === projectId.value) ?? null);
const selectedWorkTypeGroup = computed(
  () => workTypeGroups.value.find((group) => group.id === workTypeGroupId.value) ?? null,
);
const selectedWorkType = computed(() => findWorkTypeById(workTypeGroups.value, itemId.value));
const availableWorkTypes = computed(
  () => workTypeGroups.value.find((group) => group.id === workTypeGroupId.value)?.children ?? [],
);
const statusText = computed(() => {
  if (props.status === 'enabled') {
    return '已启用';
  }
  if (props.status === 'expired') {
    return '已过期';
  }
  return '已禁用';
});

watch(
  () => props.config,
  async (config) => {
    if (!config) {
      resetForm();
      return;
    }

    projectId.value = config.projectId;
    workTypeGroupId.value = config.workTypeGroupId ?? '';
    itemId.value = config.itemId;
    hours.value = config.hours;
    work.value = config.work;
    reportTime.value = config.reportTime || DEFAULT_REPORT_TIME;
    deadline.value = config.deadline ?? '';

    await loadProjectWorkTypes(config.projectId, false);
    syncWorkTypeGroup(config.itemId);
  },
  { immediate: true },
);

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

function syncWorkTypeGroup(nextItemId = itemId.value): void {
  if (!nextItemId || workTypeGroupId.value) {
    return;
  }

  workTypeGroupId.value =
    workTypeGroups.value.find((group) => group.children.some((child) => child.id === nextItemId))?.id ?? '';
}

async function loadProjectWorkTypes(nextProjectId: string, showError = true): Promise<void> {
  if (!nextProjectId) {
    workTypes.value = [];
    workTypeGroupId.value = '';
    return;
  }

  try {
    workTypes.value = await props.loadWorkTypes(nextProjectId);
  } catch (error) {
    workTypes.value = [];
    workTypeGroupId.value = '';
    if (showError) {
      showToast(error instanceof Error ? error.message : '加载工时类型失败。');
    }
  }
}

async function toggleOpen(): Promise<void> {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) {
    return;
  }

  try {
    await props.loadProjects();
    if (projectId.value) {
      await loadProjectWorkTypes(projectId.value, false);
      syncWorkTypeGroup();
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加载项目或工时类型失败。');
  }
}

async function handleProjectChange(nextProjectId: string): Promise<void> {
  projectId.value = nextProjectId;
  workTypeGroupId.value = '';
  itemId.value = '';
  await loadProjectWorkTypes(nextProjectId);
}

function handleWorkTypeGroupChange(nextGroupId: string): void {
  workTypeGroupId.value = nextGroupId;
  itemId.value = '';
}

function handleWorkTypeChange(nextItemId: string): void {
  itemId.value = nextItemId;
}

async function handleSave(): Promise<void> {
  if (!props.userId) {
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

  const result = await props.saveConfig({
    userId: props.userId,
    enabled: true,
    projectId: projectId.value,
    projectTitle: selectedProject.value.title,
    projectStatus: selectedProject.value.status,
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
    emit('updated');
  }
}

async function handleRunNow(): Promise<void> {
  if (!props.userId) {
    showToast('请先登录再执行自动填报。');
    return;
  }

  const result = await props.triggerConfig(props.userId);
  resultDialog.value = {
    open: true,
    title: result.code === 200 ? '执行成功' : '执行失败',
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
    title: result.code === 200 ? '禁用成功' : '禁用失败',
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
        <p class="section-eyebrow">自动填报</p>
        <h2 class="section-title">今日自动填报工时</h2>
        <p class="section-status">
          状态：
          <strong>{{ statusText }}</strong>
        </p>
        <p v-if="config?.reportTime" class="section-helper">填报时间：{{ config.reportTime }}</p>
        <p v-if="config?.deadline" class="section-helper">截止日期：{{ config.deadline }}</p>
      </div>
      <button class="action-button" type="button" @click="toggleOpen">
        {{ isOpen ? '收起' : '配置' }}
      </button>
    </header>

    <div v-if="isOpen" class="form-grid">
      <label>
        <span>项目</span>
        <select :value="projectId" @change="handleProjectChange(($event.target as HTMLSelectElement).value)">
          <option value="">请选择项目</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
        </select>
      </label>

      <label>
        <span>一级工时类型</span>
        <select
          :value="workTypeGroupId"
          :disabled="workTypeGroups.length === 0"
          @change="handleWorkTypeGroupChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择一级类型</option>
          <option v-for="group in workTypeGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
        </select>
      </label>

      <label>
        <span>二级工时类型</span>
        <select
          :value="itemId"
          :disabled="availableWorkTypes.length === 0"
          @change="handleWorkTypeChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择二级类型</option>
          <option v-for="item in availableWorkTypes" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>

      <label>
        <span>工时</span>
        <input v-model.number="hours" type="number" min="1" max="24" />
      </label>

      <label>
        <span>填报时间</span>
        <input v-model="reportTime" type="time" />
      </label>

      <label>
        <span>截止日期</span>
        <input v-model="deadline" type="date" />
      </label>

      <label class="full">
        <span>工作内容</span>
        <textarea v-model="work" rows="3" placeholder="输入自动填报的工作内容"></textarea>
      </label>

      <p class="field-helper full">
        若未设置截止日期，调度器会在每个有效工作日的填报时间自动填报当天工时。
      </p>
    </div>

    <div v-if="isOpen" class="actions">
      <button class="primary-button" type="button" :disabled="isSaving || isProjectsLoading" @click="handleSave">
        {{ isSaving ? '保存中...' : '保存自动填报配置' }}
      </button>
      <button
        v-if="status === 'enabled'"
        class="secondary-button"
        type="button"
        :disabled="isTriggering"
        @click="handleRunNow"
      >
        {{ isTriggering ? '执行中...' : '立即执行自动填报' }}
      </button>
      <button
        v-if="status === 'enabled'"
        class="secondary-button"
        type="button"
        :disabled="isDisabling"
        @click="handleDisable"
      >
        {{ isDisabling ? '禁用中...' : '禁用自动填报' }}
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
