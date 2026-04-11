<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { buildBatchPayload, generateContent, submitBatch } from '../../api/timesheet-client';
import type { Project, TimesheetEntry, WeekDay, WorkTypeNode } from '../../types/timesheet';
import { formatDisplayDate } from '../../utils/date';

const props = defineProps<{
  userId: string | null;
  fillableDays: WeekDay[];
  projects: Project[];
  isProjectsLoading: boolean;
  loadProjects: () => Promise<void>;
  loadWorkTypes: (projectId: string) => Promise<WorkTypeNode[]>;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const isOpen = shallowRef(false);
const workTypes = shallowRef<WorkTypeNode[]>([]);
const projectId = shallowRef('');
const workTypeId = shallowRef('');
const workTypeName = shallowRef('');
const hours = shallowRef(8);
const work = shallowRef('');
const daysToGenerate = shallowRef(0);
const entries = shallowRef<TimesheetEntry[]>([]);
const isGenerating = shallowRef(false);
const isSubmitting = shallowRef(false);
const toastMessage = shallowRef('');
const resultDialog = shallowRef<{ open: boolean; title: string; message: string }>({
  open: false,
  title: '',
  message: '',
});

const maxFillDays = computed(() => props.fillableDays.length);
const sortedFillableDays = computed(() => [...props.fillableDays].sort((left, right) => left.date.localeCompare(right.date)));
const selectedProject = computed(() => props.projects.find((project) => project.id === projectId.value) ?? null);
const flatWorkTypes = computed(() => flattenWorkTypes(workTypes.value));

watch(
  () => props.fillableDays,
  (days) => {
    if (daysToGenerate.value === 0 || daysToGenerate.value > days.length) {
      daysToGenerate.value = days.length;
    }
  },
  { immediate: true },
);

function flattenWorkTypes(nodes: WorkTypeNode[]): WorkTypeNode[] {
  return nodes.flatMap((node) => (node.children && node.children.length > 0 ? node.children : [node]));
}

function showToast(message: string): void {
  toastMessage.value = message;
  window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
  (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 2600);
}

async function openPanel(): Promise<void> {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    try {
      await props.loadProjects();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '获取项目列表失败。');
    }
  }
}

async function handleProjectChange(nextProjectId: string): Promise<void> {
  projectId.value = nextProjectId;
  workTypeId.value = '';
  workTypeName.value = '';
  try {
    workTypes.value = await props.loadWorkTypes(nextProjectId);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '获取工时类型失败。');
  }
}

function handleWorkTypeChange(nextWorkTypeId: string): void {
  workTypeId.value = nextWorkTypeId;
  workTypeName.value = flatWorkTypes.value.find((item) => item.id === nextWorkTypeId)?.name ?? '';
}

async function handleGenerate(): Promise<void> {
  if (!selectedProject.value || !workTypeId.value) {
    showToast('请选择项目和工时类型。');
    return;
  }
  if (!work.value.trim()) {
    showToast('请填写工作内容后再生成。');
    return;
  }
  if (daysToGenerate.value <= 0) {
    showToast('生成天数至少为 1。');
    return;
  }
  if (daysToGenerate.value > maxFillDays.value) {
    showToast('生成天数不能超过当前可补填的未填天数。');
    return;
  }

  isGenerating.value = true;
  try {
    const contents = await generateContent(work.value.trim(), daysToGenerate.value);
    const targetDays = sortedFillableDays.value.slice(0, daysToGenerate.value);
    entries.value = targetDays.map((day, index) => ({
      reportDate: day.date,
      projectId: selectedProject.value!.id,
      projectTitle: selectedProject.value!.title,
      projectStatus: selectedProject.value!.status,
      itemId: workTypeId.value,
      itemName: workTypeName.value,
      content: contents[index] || '日常工作处理',
      hours: hours.value,
    }));
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'AI 生成工时失败。');
  } finally {
    isGenerating.value = false;
  }
}

function updateEntryDate(index: number, nextDate: string): void {
  const fillableDateSet = new Set(props.fillableDays.map((day) => day.date));
  const duplicated = entries.value.some((entry, entryIndex) => entryIndex !== index && entry.reportDate === nextDate);
  if (!fillableDateSet.has(nextDate) || duplicated) {
    showToast('日期只能选择当前可补填日期，且不能重复。');
    return;
  }

  entries.value[index] = {
    ...entries.value[index],
    reportDate: nextDate,
  };
}

function updateEntryContent(index: number, nextValue: string): void {
  entries.value[index] = {
    ...entries.value[index],
    content: nextValue,
  };
}

function updateEntryHours(index: number, nextValue: number): void {
  entries.value[index] = {
    ...entries.value[index],
    hours: nextValue,
  };
}

async function handleSubmit(): Promise<void> {
  if (entries.value.length === 0) {
    showToast('请先生成工时列表。');
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await submitBatch(buildBatchPayload(entries.value));
    resultDialog.value = {
      open: true,
      title: result.code === 200 ? '提交结果' : '提交失败',
      message: result.msg,
    };
    if (result.code === 200) {
      entries.value = [];
      emit('submitted');
    }
  } catch (error) {
    resultDialog.value = {
      open: true,
      title: '提交失败',
      message: error instanceof Error ? error.message : '提交工时失败。',
    };
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="panel">
    <header class="section-header">
      <div>
        <p class="section-eyebrow">手动补填</p>
        <h2 class="section-title">填报工时（{{ maxFillDays }}天）</h2>
      </div>
      <button
        v-if="maxFillDays > 0"
        class="action-button"
        type="button"
        @click="openPanel"
      >
        {{ isOpen ? '收起' : '展开' }}
      </button>
    </header>

    <div v-if="maxFillDays === 0" class="state-block">本周当前没有可补填的工作日。</div>
    <template v-else-if="isOpen">
      <div class="form-grid">
        <label>
          <span>项目</span>
          <select :value="projectId" @change="handleProjectChange(($event.target as HTMLSelectElement).value)">
            <option value="">请选择项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select>
        </label>

        <label>
          <span>工时类型</span>
          <select :value="workTypeId" @change="handleWorkTypeChange(($event.target as HTMLSelectElement).value)">
            <option value="">请选择工时类型</option>
            <option v-for="item in flatWorkTypes" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>

        <label>
          <span>工时</span>
          <input v-model.number="hours" type="number" min="1" max="24" />
        </label>

        <label>
          <span>未填天数</span>
          <input v-model.number="daysToGenerate" type="number" min="1" :max="maxFillDays" />
        </label>
      </div>

      <label class="block-field">
        <span>工作内容</span>
        <textarea
          v-model="work"
          rows="3"
          placeholder="输入工作内容，AI 会生成适合工时填报的描述。"
        />
      </label>

      <div class="inline-actions">
        <button class="primary-button" type="button" :disabled="isGenerating || isProjectsLoading" @click="handleGenerate">
          {{ isGenerating ? '生成中...' : '生成工时' }}
        </button>
        <span class="helper-text" v-if="isProjectsLoading">正在获取项目列表...</span>
      </div>

      <div v-if="entries.length > 0" class="entry-list">
        <article v-for="(entry, index) in entries" :key="`${entry.reportDate}-${index}`" class="entry-card">
          <label>
            <span>日期</span>
            <select :value="entry.reportDate" @change="updateEntryDate(index, ($event.target as HTMLSelectElement).value)">
              <option v-for="day in sortedFillableDays" :key="day.date" :value="day.date">
                {{ formatDisplayDate(day.date) }}
              </option>
            </select>
          </label>
          <label>
            <span>工时</span>
            <input :value="entry.hours" type="number" min="1" max="24" @input="updateEntryHours(index, Number(($event.target as HTMLInputElement).value))" />
          </label>
          <label class="entry-card__content">
            <span>内容</span>
            <textarea :value="entry.content" rows="3" @input="updateEntryContent(index, ($event.target as HTMLTextAreaElement).value)" />
          </label>
        </article>

        <button class="primary-button" type="button" :disabled="isSubmitting" @click="handleSubmit">
          {{ isSubmitting ? '提交中...' : '提交补填工时' }}
        </button>
      </div>
    </template>

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
  margin: 0.25rem 0 0;
  color: #13272c;
}

.action-button,
.primary-button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.action-button {
  background: #ece8df;
  color: #24383f;
}

.primary-button {
  background: #0f4f53;
  color: #fff;
}

.form-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
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

.block-field,
.entry-list {
  margin-top: 0.9rem;
}

.inline-actions {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.helper-text {
  color: #7c6c54;
  font-size: 0.86rem;
}

.entry-list {
  display: grid;
  gap: 0.75rem;
}

.entry-card {
  padding: 0.9rem;
  border-radius: 18px;
  background: #f6f3ec;
  display: grid;
  gap: 0.7rem;
}

.entry-card__content {
  grid-column: 1 / -1;
}

.state-block {
  margin-top: 1rem;
  border-radius: 18px;
  padding: 1rem;
  background: #f4f1ea;
  color: #6c665b;
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
