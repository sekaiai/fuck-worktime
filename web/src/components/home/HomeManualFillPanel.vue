<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import { buildBatchPayload, generateContent, submitBatch } from '../../api/timesheet-client';
import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import type { Project, TimesheetEntry, WeekDay, WorkTypeNode } from '../../types/timesheet';
import { formatDisplayDate } from '../../utils/date';
import { buildWorkTypeGroups, findWorkTypeById } from '../../utils/work-types';

const props = defineProps<{
  visible: boolean;
  fillableDays: WeekDay[];
  projects: Project[];
  isProjectsLoading: boolean;
  recommendedDaysToGenerate?: number | null;
  preferredReportDate?: string | null;
  preferredStep?: 1 | 2 | 3;
  loadProjects: () => Promise<void>;
  loadWorkTypes: (projectId: string) => Promise<WorkTypeNode[]>;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [];
}>();

const workTypes = shallowRef<WorkTypeNode[]>([]);
const projectId = shallowRef('');
const workTypeGroupId = shallowRef('');
const workTypeId = shallowRef('');
const hours = shallowRef(8);
const work = shallowRef('');
const daysToGenerate = shallowRef(0);
const entries = shallowRef<TimesheetEntry[]>([]);
const isGenerating = shallowRef(false);
const isSubmitting = shallowRef(false);
const toastMessage = shallowRef('');
const resultDialog = ref<{ open: boolean; title: string; message: string }>({
  open: false,
  title: '',
  message: '',
});
const currentStep = shallowRef<1 | 2 | 3>(1);
const compactReviewMode = shallowRef(true);
const projectSelectRef = ref<HTMLSelectElement | null>(null);

const maxFillDays = computed(() => props.fillableDays.length);
const sortedFillableDays = computed(() =>
  [...props.fillableDays].sort((left, right) => left.date.localeCompare(right.date)),
);
const selectedProject = computed(() => props.projects.find((project) => project.id === projectId.value) ?? null);
const workTypeGroups = computed(() => buildWorkTypeGroups(workTypes.value));
const selectedWorkType = computed(() => findWorkTypeById(workTypeGroups.value, workTypeId.value));
const availableWorkTypes = computed(
  () => workTypeGroups.value.find((group) => group.id === workTypeGroupId.value)?.children ?? [],
);
const stepSummary = computed(() => {
  if (currentStep.value === 1) {
    return '先选择项目、工时类型和要补填的天数。';
  }
  if (currentStep.value === 2) {
    return '输入工作内容主题，系统会按天生成可提交描述。';
  }
  const totalEntryHours = entries.value.reduce((sum, entry) => sum + entry.hours, 0);
  return `本次共 ${entries.value.length} 条记录，预计提交 ${totalEntryHours} 小时。`;
});
const previewDates = computed(() => sortedFillableDays.value.slice(0, 5));

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      return;
    }

    currentStep.value = props.preferredStep ?? 1;

    if (props.projects.length === 0) {
      try {
        await props.loadProjects();
      } catch (error) {
        showToast(error instanceof Error ? error.message : '获取项目列表失败。');
      }
    }

    if (currentStep.value > 1 && !isStepTwoReady()) {
      currentStep.value = 1;
      showToast('请先在第 1 步选择项目和二级工时类型，再继续快速补填。');
      await nextTick();
      projectSelectRef.value?.focus();
      return;
    }

    if (currentStep.value === 2 && !work.value.trim()) {
      showToast('请填写工作内容后再继续。');
    }
  },
);

watch(
  () => props.recommendedDaysToGenerate,
  (recommended) => {
    if (!recommended || recommended <= 0) {
      return;
    }

    daysToGenerate.value = Math.min(recommended, maxFillDays.value || 1);
  },
);

watch(
  () => props.fillableDays,
  (days) => {
    if (daysToGenerate.value === 0 || daysToGenerate.value > days.length) {
      daysToGenerate.value = days.length;
    }

    if (days.length === 0) {
      entries.value = [];
    }
  },
  { immediate: true },
);

function resetEntries(): void {
  entries.value = [];
}

function closePanel(): void {
  resultDialog.value = { ...resultDialog.value, open: false };
  currentStep.value = 1;
  emit('close');
}

function closeResultDialog(): void {
  resultDialog.value = { ...resultDialog.value, open: false };
}

function showToast(message: string): void {
  toastMessage.value = message;
  window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
  (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 2600);
}

async function handleProjectChange(nextProjectId: string): Promise<void> {
  projectId.value = nextProjectId;
  workTypeGroupId.value = '';
  workTypeId.value = '';
  resetEntries();

  try {
    workTypes.value = await props.loadWorkTypes(nextProjectId);
  } catch (error) {
    workTypes.value = [];
    showToast(error instanceof Error ? error.message : '获取工时类型失败。');
  }
}

function handleWorkTypeGroupChange(nextGroupId: string): void {
  workTypeGroupId.value = nextGroupId;
  workTypeId.value = '';
  resetEntries();
}

function handleWorkTypeChange(nextWorkTypeId: string): void {
  workTypeId.value = nextWorkTypeId;
  resetEntries();
}

async function handleGenerate(): Promise<void> {
  const project = selectedProject.value;
  const workType = selectedWorkType.value;

  if (!project || !workType) {
    showToast('请选择项目和二级工时类型。');
    return;
  }
  if (!work.value.trim()) {
    showToast('请先填写工作内容。');
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
    const preferredDays =
      daysToGenerate.value === 1 && props.preferredReportDate
        ? sortedFillableDays.value.filter((day) => day.date === props.preferredReportDate).slice(0, 1)
        : [];
    const targetDays =
      preferredDays.length > 0
        ? preferredDays
        : sortedFillableDays.value.slice(0, daysToGenerate.value);
    entries.value = targetDays.map((day, index) => ({
      reportDate: day.date,
      projectId: project.id,
      projectTitle: project.title,
      projectStatus: project.status,
      itemId: workType.id,
      itemName: workType.name,
      content: contents[index] ?? '日常工作处理',
      hours: hours.value,
    }));
    currentStep.value = 3;
  } catch (error) {
    showToast(error instanceof Error ? error.message : '生成工时失败。');
  } finally {
    isGenerating.value = false;
  }
}

function goToStep(step: 1 | 2 | 3): void {
  if (step === 3 && entries.value.length === 0) {
    showToast('请先生成工时列表。');
    return;
  }

  currentStep.value = step;
}

function isStepTwoReady(): boolean {
  return Boolean(projectId.value && workTypeId.value);
}

function updateEntry(index: number, patch: Partial<TimesheetEntry>): void {
  const nextEntries = [...entries.value];
  nextEntries[index] = {
    ...nextEntries[index],
    ...patch,
  };
  entries.value = nextEntries;
}

function updateEntryDate(index: number, nextDate: string): void {
  const fillableDateSet = new Set(props.fillableDays.map((day) => day.date));
  const duplicated = entries.value.some((entry, entryIndex) => entryIndex !== index && entry.reportDate === nextDate);
  if (!fillableDateSet.has(nextDate) || duplicated) {
    showToast('日期只能选择当前可补填日期，且不能重复。');
    return;
  }

  updateEntry(index, { reportDate: nextDate });
}

function updateEntryContent(index: number, nextValue: string): void {
  updateEntry(index, { content: nextValue });
}

function updateEntryHours(index: number, nextValue: number): void {
  const safeHours = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1;
  updateEntry(index, { hours: safeHours });
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
      resetEntries();
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
  <section v-if="visible" class="manual-panel">
    <header class="manual-panel__header">
      <div>
        <p class="manual-panel__eyebrow">Manual Fill</p>
        <h2 class="manual-panel__title">批量补填未提交工时</h2>
      </div>
      <button class="manual-panel__close" type="button" @click="closePanel">收起</button>
    </header>

    <div v-if="maxFillDays === 0" class="manual-panel__state">当前这周没有可补填的工作日。</div>
    <template v-else>
      <div class="manual-panel__intro">
        <p class="manual-panel__copy">{{ stepSummary }}</p>
        <div class="manual-panel__dates">
          <span>待处理日期</span>
          <strong v-for="day in previewDates" :key="day.date">{{ formatDisplayDate(day.date) }}</strong>
        </div>
      </div>

      <div class="manual-panel__stepper">
        <button type="button" :class="{ active: currentStep === 1 }" @click="goToStep(1)">1. 选择类型</button>
        <button type="button" :class="{ active: currentStep === 2 }" @click="goToStep(2)">2. 生成内容</button>
        <button type="button" :class="{ active: currentStep === 3 }" @click="goToStep(3)">3. 校对提交</button>
      </div>

      <div v-show="currentStep === 1" class="manual-panel__form">
        <label>
          <span>项目</span>
          <select
            ref="projectSelectRef"
            :value="projectId"
            @change="handleProjectChange(($event.target as HTMLSelectElement).value)"
          >
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
            :value="workTypeId"
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
          <span>生成天数</span>
          <input v-model.number="daysToGenerate" type="number" min="1" :max="maxFillDays" />
        </label>
      </div>

      <label v-show="currentStep === 2" class="manual-panel__block-field">
        <span>工作内容主题</span>
        <textarea
          v-model="work"
          rows="4"
          placeholder="输入工作内容主题，系统会为每一天生成适合提交的描述。"
        />
      </label>

      <p v-show="currentStep === 2 && daysToGenerate > maxFillDays" class="manual-panel__warning">
        生成天数不能超过当前可补填的未填天数。
      </p>

      <div v-show="currentStep === 2" class="manual-panel__inline-actions">
        <button
          class="manual-panel__primary"
          type="button"
          :disabled="isGenerating || isProjectsLoading"
          @click="handleGenerate"
        >
          {{ isGenerating ? '生成中...' : '生成工时描述' }}
        </button>
        <span v-if="isProjectsLoading" class="manual-panel__helper">正在获取项目列表...</span>
      </div>

      <div v-show="currentStep === 3 && entries.length > 0" class="manual-panel__entry-list">
        <label class="manual-panel__compact-switch">
          <input v-model="compactReviewMode" type="checkbox" />
          <span>简化校对模式，仅检查日期与摘要</span>
        </label>

        <article v-for="(entry, index) in entries" :key="`${entry.reportDate}-${index}`" class="manual-panel__entry-card">
          <label>
            <span>日期</span>
            <select :value="entry.reportDate" @change="updateEntryDate(index, ($event.target as HTMLSelectElement).value)">
              <option v-for="day in sortedFillableDays" :key="day.date" :value="day.date">
                {{ formatDisplayDate(day.date) }}
              </option>
            </select>
          </label>
          <label>
            <span>项目</span>
            <input :value="entry.projectTitle" disabled />
          </label>
          <label>
            <span>工时类型</span>
            <input :value="entry.itemName || selectedWorkType?.name || ''" disabled />
          </label>

          <template v-if="compactReviewMode">
            <p class="manual-panel__entry-summary">{{ entry.hours }}h · {{ entry.content }}</p>
          </template>
          <template v-else>
            <label>
              <span>工时</span>
              <input
                :value="entry.hours"
                type="number"
                min="1"
                max="24"
                @input="updateEntryHours(index, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="manual-panel__entry-content">
              <span>内容</span>
              <textarea
                :value="entry.content"
                rows="3"
                @input="updateEntryContent(index, ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </template>
        </article>

        <button class="manual-panel__primary" type="button" :disabled="isSubmitting" @click="handleSubmit">
          {{ isSubmitting ? '提交中...' : '提交补填工时' }}
        </button>
      </div>

      <div class="manual-panel__inline-actions">
        <button
          class="manual-panel__secondary"
          type="button"
          :disabled="currentStep === 1"
          @click="goToStep((currentStep - 1) as 1 | 2 | 3)"
        >
          上一步
        </button>
        <button
          class="manual-panel__primary"
          type="button"
          :disabled="currentStep === 3"
          @click="goToStep((currentStep + 1) as 1 | 2 | 3)"
        >
          下一步
        </button>
      </div>
    </template>

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
.manual-panel {
  position: relative;
  display: grid;
  gap: 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 30px;
  padding: 1.25rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.84), rgba(240, 233, 224, 0.72));
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.1);
}

.manual-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.manual-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.manual-panel__title {
  font-size: clamp(1.7rem, 4vw, 2.3rem);
}

.manual-panel__close,
.manual-panel__primary,
.manual-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.manual-panel__close,
.manual-panel__secondary {
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

.manual-panel__primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.manual-panel__intro {
  display: grid;
  gap: 0.8rem;
  border-radius: 22px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.manual-panel__copy,
.manual-panel__helper {
  color: var(--ink-soft);
  line-height: 1.7;
}

.manual-panel__dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.manual-panel__dates span {
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.manual-panel__dates strong {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.8rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.82rem;
}

.manual-panel__stepper {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.manual-panel__stepper button {
  border: 0;
  border-radius: 18px;
  min-height: 3.3rem;
  padding: 0.8rem;
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

.manual-panel__stepper button.active {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.manual-panel__form {
  display: grid;
  gap: 0.8rem;
}

.manual-panel label {
  display: grid;
  gap: 0.35rem;
}

.manual-panel span {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.manual-panel select,
.manual-panel input,
.manual-panel textarea {
  width: 100%;
  border: 1px solid rgba(19, 38, 40, 0.14);
  border-radius: 18px;
  padding: 0.86rem 0.95rem;
  background: rgba(255, 255, 255, 0.72);
}

.manual-panel input:disabled {
  color: var(--ink-soft);
  background: rgba(229, 225, 217, 0.9);
}

.manual-panel__block-field,
.manual-panel__entry-list {
  display: grid;
  gap: 0.8rem;
}

.manual-panel__inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.manual-panel__warning {
  color: var(--danger);
}

.manual-panel__compact-switch {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
}

.manual-panel__entry-list {
  gap: 0.85rem;
}

.manual-panel__entry-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.manual-panel__entry-summary {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 16px;
  background: rgba(19, 38, 40, 0.06);
  line-height: 1.65;
}

.manual-panel__entry-content {
  grid-column: 1 / -1;
}

.manual-panel__state {
  border-radius: 22px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
  color: var(--ink-soft);
}

@media (max-width: 720px) {
  .manual-panel__header,
  .manual-panel__inline-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .manual-panel__stepper {
    grid-template-columns: 1fr;
  }
}
</style>
