<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';

import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import { useTemplatePrefill } from '../../composables/useTemplatePrefill';
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
const workTypeGroupId = shallowRef('');
const itemId = shallowRef('');
const itemName = shallowRef('');
const hours = shallowRef(8);
const work = shallowRef('');
const deadline = shallowRef('');
const toastMessage = shallowRef('');
const resultDialog = ref<{ open: boolean; title: string; message: string }>({
  open: false,
  title: '',
  message: '',
});
const compactMode = shallowRef(true);
const { getQuickTemplates, prefillIfEmpty } = useTemplatePrefill();
const quickTemplates = getQuickTemplates();

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
      deadline.value = '';
      workTypes.value = [];
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
      workTypeGroupId.value =
        workTypeGroups.value.find((group) => group.children.some((child) => child.id === config.itemId))?.id ?? '';
    } catch {
      workTypes.value = [];
      workTypeGroupId.value = '';
    }
  },
  { immediate: true },
);

watch(compactMode, (value) => {
  if (!value && prefillIfEmpty(work.value, (nextValue) => {
    work.value = nextValue;
  })) {
    showToast('已自动填入推荐模板，可继续编辑后保存。');
  }
});

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

    if (!compactMode.value && prefillIfEmpty(work.value, (nextValue) => {
      work.value = nextValue;
    })) {
      showToast('已自动填入推荐模板，可继续编辑后保存。');
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '获取项目或工时类型失败。');
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
    showToast(error instanceof Error ? error.message : '获取工时类型失败。');
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

function applyTemplate(template: string): void {
  work.value = template;
}

async function handleSave(): Promise<void> {
  if (!props.userId) {
    showToast('请先登录后再配置自动填报。');
    return;
  }
  if (!projectId.value || !workTypeGroupId.value || !itemId.value) {
    showToast('请选择项目、一级类型和二级类型。');
    return;
  }

  const project = props.projects.find((item) => item.id === projectId.value);
  const result = await props.saveConfig({
    userId: props.userId,
    enabled: true,
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
      <label class="compact-switch full">
        <input v-model="compactMode" type="checkbox" />
        <span>简化模式（默认隐藏截止日期和工作内容）</span>
      </label>

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

      <label v-show="!compactMode">
        <span>截止日期</span>
        <input v-model="deadline" type="date" />
      </label>

      <label v-show="!compactMode" class="full">
        <span>工作内容</span>
        <textarea
          v-model="work"
          rows="3"
          placeholder="不设置截止日期，则会在每个可填报工作日自动填报当天工时。"
        />
      </label>

      <div v-show="!compactMode" class="quick-templates full">
        <span>快捷模板</span>
        <button
          v-for="template in quickTemplates"
          :key="template"
          type="button"
          class="template-chip"
          @click="applyTemplate(template)"
        >
          {{ template }}
        </button>
      </div>
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

.compact-switch {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  color: #445b62;
  font-size: 0.88rem;
}

.quick-templates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.quick-templates > span {
  color: #7c6c54;
  font-size: 0.82rem;
}

.template-chip {
  border: 0;
  border-radius: 999px;
  padding: 0.48rem 0.75rem;
  background: #ece8df;
  color: #31454c;
  font-size: 0.82rem;
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

@media (max-width: 680px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
