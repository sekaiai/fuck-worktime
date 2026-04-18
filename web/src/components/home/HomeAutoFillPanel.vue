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
const overviewItems = computed(() => {
  if (!props.config) {
    return [];
  }

  return [
    { label: '项目', value: props.config.projectTitle || '未配置' },
    { label: '工时类型', value: props.config.itemName || '未配置' },
    { label: '填报时间', value: props.config.reportTime || DEFAULT_REPORT_TIME },
    { label: '截止日期', value: props.config.deadline || '长期有效' },
  ];
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
  <section class="auto-fill-panel" :class="{ 'is-open': isOpen }">
    <header class="auto-fill-panel__header">
      <div>
        <p class="auto-fill-panel__eyebrow">Auto Fill</p>
        <h2 class="auto-fill-panel__title">自动填报策略</h2>
      </div>
      <span class="auto-fill-panel__badge" :class="`is-${status}`">{{ statusText }}</span>
    </header>

    <p class="auto-fill-panel__copy">
      维护一个固定策略后，系统会在设定时间自动为可填报工作日生成内容并提交。
    </p>

    <div v-if="overviewItems.length > 0" class="auto-fill-panel__overview">
      <article v-for="item in overviewItems" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
    <div v-else class="auto-fill-panel__empty">当前还没有自动填报配置，展开后即可开始设置。</div>

    <button class="auto-fill-panel__toggle" type="button" @click="toggleOpen">
      {{ isOpen ? '收起配置面板' : '展开配置面板' }}
    </button>

    <Transition name="auto-fill-expand">
      <div v-if="isOpen" class="auto-fill-panel__editor">
        <div class="auto-fill-panel__form">
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

          <label class="auto-fill-panel__full">
            <span>工作内容模板</span>
            <textarea v-model="work" rows="4" placeholder="输入自动填报使用的工作内容模板"></textarea>
          </label>
        </div>

        <p class="auto-fill-panel__hint">
          若未设置截止日期，调度器会在每个有效工作日的指定时间自动尝试填报当天工时。
        </p>

        <div class="auto-fill-panel__actions">
          <button
            class="auto-fill-panel__primary"
            type="button"
            :disabled="isSaving || isProjectsLoading"
            @click="handleSave"
          >
            {{ isSaving ? '保存中...' : '保存自动填报配置' }}
          </button>
          <button
            v-if="status === 'enabled'"
            class="auto-fill-panel__secondary"
            type="button"
            :disabled="isTriggering"
            @click="handleRunNow"
          >
            {{ isTriggering ? '执行中...' : '立即执行' }}
          </button>
          <button
            v-if="status === 'enabled'"
            class="auto-fill-panel__secondary"
            type="button"
            :disabled="isDisabling"
            @click="handleDisable"
          >
            {{ isDisabling ? '禁用中...' : '禁用策略' }}
          </button>
        </div>
      </div>
    </Transition>

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
.auto-fill-panel {
  position: relative;
  display: grid;
  gap: 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 28px;
  padding: 1.25rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.84), rgba(240, 233, 224, 0.72));
  box-shadow: 0 22px 44px rgba(20, 41, 44, 0.09);
}

.auto-fill-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.auto-fill-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.auto-fill-panel__title {
  font-size: 1.55rem;
}

.auto-fill-panel__copy,
.auto-fill-panel__hint {
  color: var(--ink-soft);
  line-height: 1.7;
}

.auto-fill-panel__badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.auto-fill-panel__badge.is-enabled {
  background: rgba(35, 76, 75, 0.14);
  color: var(--accent);
}

.auto-fill-panel__badge.is-expired {
  background: rgba(170, 71, 55, 0.1);
  color: var(--danger);
}

.auto-fill-panel__overview {
  display: grid;
  gap: 0.7rem;
}

.auto-fill-panel__overview article {
  display: grid;
  gap: 0.25rem;
  border-radius: 18px;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.auto-fill-panel__overview span {
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auto-fill-panel__overview strong {
  font-family: var(--font-display);
  font-size: 1rem;
}

.auto-fill-panel__empty {
  border-radius: 18px;
  padding: 0.95rem;
  background: rgba(255, 255, 255, 0.46);
  color: var(--ink-soft);
}

.auto-fill-panel__toggle,
.auto-fill-panel__primary,
.auto-fill-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.auto-fill-panel__toggle,
.auto-fill-panel__secondary {
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

.auto-fill-panel__primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.auto-fill-panel__editor {
  display: grid;
  gap: 1rem;
}

.auto-fill-panel__form {
  display: grid;
  gap: 0.8rem;
}

.auto-fill-panel__form label {
  display: grid;
  gap: 0.35rem;
  color: var(--ink-strong);
}

.auto-fill-panel__full {
  grid-column: 1 / -1;
}

.auto-fill-panel__form span {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.auto-fill-panel__form select,
.auto-fill-panel__form input,
.auto-fill-panel__form textarea {
  width: 100%;
  border: 1px solid rgba(19, 38, 40, 0.14);
  border-radius: 18px;
  padding: 0.86rem 0.95rem;
  background: rgba(255, 255, 255, 0.72);
}

.auto-fill-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.auto-fill-expand-enter-active,
.auto-fill-expand-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.auto-fill-expand-enter-from,
.auto-fill-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 640px) {
  .auto-fill-panel__header {
    flex-direction: column;
  }
}
</style>
