<script setup lang="ts">
import { shallowRef, watch } from 'vue';

import type { AutoFillConfig, AutoFillStatus } from '../../types/auto-fill';
import type { Project, WorkTypeNode } from '../../types/timesheet';

const props = defineProps<{
  userId: string | null;
  config: AutoFillConfig | null;
  status: AutoFillStatus;
  projects: Project[];
  isProjectsLoading: boolean;
  isSaving: boolean;
  isDisabling: boolean;
  loadProjects: () => Promise<void>;
  loadWorkTypes: (projectId: string) => Promise<WorkTypeNode[]>;
  saveConfig: (payload: Partial<AutoFillConfig> & { userId: string }) => Promise<{ code: number; msg: string }>;
  disableConfig: (userId: string) => Promise<{ code: number; msg: string }>;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const isOpen = shallowRef(false);
const workTypes = shallowRef<WorkTypeNode[]>([]);
const projectId = shallowRef('');
const itemId = shallowRef('');
const itemName = shallowRef('');
const hours = shallowRef(8);
const work = shallowRef('');
const deadline = shallowRef('');
const toastMessage = shallowRef('');
const resultDialog = shallowRef<{ open: boolean; title: string; message: string }>({
  open: false,
  title: '',
  message: '',
});

watch(
  () => props.config,
  async (config) => {
    if (!config) {
      return;
    }

    projectId.value = config.projectId;
    itemId.value = config.itemId;
    itemName.value = config.itemName;
    hours.value = config.hours;
    work.value = config.work;
    deadline.value = config.deadline ?? '';
    try {
      workTypes.value = await props.loadWorkTypes(config.projectId);
    } catch {
      workTypes.value = [];
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

async function toggleOpen(): Promise<void> {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    try {
      await props.loadProjects();
      if (projectId.value) {
        workTypes.value = await props.loadWorkTypes(projectId.value);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '获取项目或工时类型失败。');
    }
  }
}

async function handleProjectChange(nextProjectId: string): Promise<void> {
  projectId.value = nextProjectId;
  itemId.value = '';
  itemName.value = '';
  try {
    workTypes.value = await props.loadWorkTypes(nextProjectId);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '获取工时类型失败。');
  }
}

function handleWorkTypeChange(nextItemId: string): void {
  itemId.value = nextItemId;
  itemName.value =
    workTypes.value.flatMap((item) => (item.children && item.children.length > 0 ? item.children : [item]))
      .find((item) => item.id === nextItemId)?.name ?? '';
}

async function handleSave(): Promise<void> {
  if (!props.userId) {
    showToast('请先登录后再配置自动填报。');
    return;
  }
  if (!projectId.value || !itemId.value) {
    showToast('请选择项目和工时类型。');
    return;
  }

  const project = props.projects.find((item) => item.id === projectId.value);
  const result = await props.saveConfig({
    userId: props.userId,
    enabled: true,
    expired: false,
    projectId: projectId.value,
    projectTitle: project?.title ?? '',
    projectStatus: project?.status ?? 20,
    itemId: itemId.value,
    itemName: itemName.value,
    hours: hours.value,
    work: work.value.trim(),
    deadline: deadline.value || null,
  });

  resultDialog.value = {
    open: true,
    title: result.code === 200 ? '保存结果' : '保存失败',
    message: result.msg,
  };
  if (result.code === 200) {
    emit('updated');
  }
}

async function handleDisable(): Promise<void> {
  if (!props.userId) {
    return;
  }

  const result = await props.disableConfig(props.userId);
  resultDialog.value = {
    open: true,
    title: result.code === 200 ? '关闭结果' : '关闭失败',
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
        <h2 class="section-title">自动填报当天工时</h2>
        <p class="section-status">
          当前状态：
          <strong>{{ status === 'enabled' ? '已开启' : status === 'expired' ? '已截止' : '未开启' }}</strong>
        </p>
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
        <span>工时类型</span>
        <select :value="itemId" @change="handleWorkTypeChange(($event.target as HTMLSelectElement).value)">
          <option value="">请选择工时类型</option>
          <option
            v-for="item in workTypes.flatMap((node) => (node.children && node.children.length > 0 ? node.children : [node]))"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </label>

      <label>
        <span>工时</span>
        <input v-model.number="hours" type="number" min="1" max="24" />
      </label>

      <label>
        <span>截止日期</span>
        <input v-model="deadline" type="date" />
      </label>

      <label class="full">
        <span>工作内容</span>
        <textarea
          v-model="work"
          rows="3"
          placeholder="不设置截止日期，则会在每个可填报工作日自动填报当天工时。"
        />
      </label>
    </div>

    <div v-if="isOpen" class="actions">
      <button class="primary-button" type="button" :disabled="isSaving || isProjectsLoading" @click="handleSave">
        {{ isSaving ? '保存中...' : '保存自动填报' }}
      </button>
      <button
        v-if="status === 'enabled'"
        class="secondary-button"
        type="button"
        :disabled="isDisabling"
        @click="handleDisable"
      >
        {{ isDisabling ? '关闭中...' : '关闭自动填报' }}
      </button>
    </div>

    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

    <div v-if="resultDialog.open" class="modal-backdrop" @click.self="resultDialog.open = false">
      <div class="modal-card">
        <h3>{{ resultDialog.title }}</h3>
        <p>{{ resultDialog.message }}</p>
        <button class="primary-button" type="button" @click="resultDialog.open = false">知道了</button>
      </div>
    </div>
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

.toast {
  position: sticky;
  bottom: 0.75rem;
  margin-top: 0.75rem;
  background: #13272c;
  color: #fff;
  padding: 0.8rem 1rem;
  border-radius: 16px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 30, 0.42);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.modal-card {
  width: min(100%, 360px);
  background: #fff;
  border-radius: 24px;
  padding: 1.2rem;
  display: grid;
  gap: 0.9rem;
}

@media (max-width: 680px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
