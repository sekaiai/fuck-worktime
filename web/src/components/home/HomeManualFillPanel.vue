<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import { buildBatchPayload, generateContent, submitBatch } from '../../api/timesheet-client';
import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import { useTemplatePrefill } from '../../composables/useTemplatePrefill';
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
const workTypeName = shallowRef('');
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
const { getQuickTemplates, prefillIfEmpty } = useTemplatePrefill();
const quickTemplates = getQuickTemplates();
const projectSelectRef = ref<HTMLSelectElement | null>(null);

const maxFillDays = computed(() => props.fillableDays.length);
const sortedFillableDays = computed(() =>
  [...props.fillableDays].sort((left, right) => left.date.localeCompare(right.date)),
);
const selectedProject = computed(() => props.projects.find((project) => project.id === projectId.value) ?? null);
const workTypeGroups = computed(() => buildWorkTypeGroups(workTypes.value));
const availableWorkTypes = computed(
  () => workTypeGroups.value.find((group) => group.id === workTypeGroupId.value)?.children ?? [],
);

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
      const applied = prefillIfEmpty(work.value, (nextValue) => {
        work.value = nextValue;
      });
      if (applied) {
        showToast('已自动填入推荐模板，可直接生成或手动调整内容。');
      }
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
  workTypeName.value = '';
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
  workTypeName.value = '';
  resetEntries();
}

function handleWorkTypeChange(nextWorkTypeId: string): void {
  workTypeId.value = nextWorkTypeId;
  workTypeName.value = findWorkTypeById(workTypeGroups.value, nextWorkTypeId)?.name ?? '';
  resetEntries();
}

async function handleGenerate(): Promise<void> {
  if (!selectedProject.value || !workTypeId.value) {
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
      projectId: selectedProject.value!.id,
      projectTitle: selectedProject.value!.title,
      projectStatus: selectedProject.value!.status,
      itemId: workTypeId.value,
      itemName: workTypeName.value,
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

function applyTemplate(template: string): void {
  work.value = template;
}

function isStepTwoReady(): boolean {
  return Boolean(projectId.value && workTypeId.value);
}

function updateEntryDate(index: number, nextDate: string): void {
  const fillableDateSet = new Set(props.fillableDays.map((day) => day.date));
  const duplicated = entries.value.some((entry, entryIndex) => entryIndex !== index && entry.reportDate === nextDate);
  if (!fillableDateSet.has(nextDate) || duplicated) {
    showToast('日期只能选择当前可补填日期，且不能重复。');
    return;
  }

  const nextEntries = [...entries.value];
  nextEntries[index] = {
    ...nextEntries[index],
    reportDate: nextDate,
  };
  entries.value = nextEntries;
}

function updateEntryContent(index: number, nextValue: string): void {
  const nextEntries = [...entries.value];
  nextEntries[index] = {
    ...nextEntries[index],
    content: nextValue,
  };
  entries.value = nextEntries;
}

function updateEntryHours(index: number, nextValue: number): void {
  const safeHours = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1;
  const nextEntries = [...entries.value];
  nextEntries[index] = {
    ...nextEntries[index],
    hours: safeHours,
  };
  entries.value = nextEntries;
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
  <section v-if="visible" class="panel">
    <header class="section-header">
      <div>
        <p class="section-eyebrow">手动补填</p>
        <h2 class="section-title">批量补填未提交工时</h2>
      </div>
      <button class="action-button" type="button" @click="closePanel">收起</button>
    </header>

    <div v-if="maxFillDays === 0" class="state-block">当前这周没有可补填的工作日。</div>
    <template v-else>
      <div class="stepper">
        <button type="button" :class="{ active: currentStep === 1 }" @click="goToStep(1)">1. 选择类型</button>
        <button type="button" :class="{ active: currentStep === 2 }" @click="goToStep(2)">2. 生成内容</button>
        <button type="button" :class="{ active: currentStep === 3 }" @click="goToStep(3)">3. 校对提交</button>
      </div>

      <div v-show="currentStep === 1" class="form-grid">
        <label>
          <span>项目</span>
          <select ref="projectSelectRef" :value="projectId" @change="handleProjectChange(($event.target as HTMLSelectElement).value)">
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
          <span>未填天数</span>
          <input v-model.number="daysToGenerate" type="number" min="1" :max="maxFillDays" />
        </label>
      </div>

      <label v-show="currentStep === 2" class="block-field">
        <span>工作内容</span>
        <textarea
          v-model="work"
          rows="3"
          placeholder="输入工作内容，系统会生成适合工时填报的描述。"
        />
      </label>
      <div v-show="currentStep === 2" class="quick-templates">
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

      <p v-show="currentStep === 2 && daysToGenerate > maxFillDays" class="warning-text">
        生成天数不能超过当前可补填的未填天数。
      </p>

      <div v-show="currentStep === 2" class="inline-actions">
        <button class="primary-button" type="button" :disabled="isGenerating || isProjectsLoading" @click="handleGenerate">
          {{ isGenerating ? '生成中...' : '生成工时' }}
        </button>
        <span class="helper-text" v-if="isProjectsLoading">正在获取项目列表...</span>
      </div>

      <div v-show="currentStep === 3 && entries.length > 0" class="entry-list">
        <label class="compact-switch">
          <input v-model="compactReviewMode" type="checkbox" />
          <span>简化校对模式（仅检查日期与摘要）</span>
        </label>

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
            <span>项目</span>
            <input :value="entry.projectTitle" disabled />
          </label>
          <label>
            <span>工时类型</span>
            <input :value="entry.itemName || workTypeName" disabled />
          </label>
          <template v-if="compactReviewMode">
            <p class="entry-card__summary">{{ entry.hours }}h · {{ entry.content }}</p>
          </template>
          <template v-else>
            <label>
              <span>工时</span>
              <input :value="entry.hours" type="number" min="1" max="24" @input="updateEntryHours(index, Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label class="entry-card__content">
              <span>内容</span>
              <textarea :value="entry.content" rows="3" @input="updateEntryContent(index, ($event.target as HTMLTextAreaElement).value)" />
            </label>
          </template>
        </article>

        <button class="primary-button" type="button" :disabled="isSubmitting" @click="handleSubmit">
          {{ isSubmitting ? '提交中...' : '提交补填工时' }}
        </button>
      </div>

      <div class="inline-actions">
        <button class="secondary-button" type="button" :disabled="currentStep === 1" @click="goToStep((currentStep - 1) as 1 | 2 | 3)">上一步</button>
        <button class="primary-button" type="button" :disabled="currentStep === 3" @click="goToStep((currentStep + 1) as 1 | 2 | 3)">下一步</button>
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

.secondary-button {
  background: #ece8df;
  color: #24383f;
}

.stepper {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.stepper button {
  border: 0;
  border-radius: 999px;
  padding: 0.65rem 0.5rem;
  background: #ece8df;
  color: #4b595f;
  font-size: 0.82rem;
}

.stepper button.active {
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

input:disabled {
  color: #5f645b;
  background: #f3f1eb;
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

.warning-text {
  margin: 0.9rem 0 0;
  color: #b42318;
}

.quick-templates {
  margin-top: 0.75rem;
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

.entry-list {
  display: grid;
  gap: 0.75rem;
}

.compact-switch {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  color: #445b62;
  font-size: 0.88rem;
}

.entry-card__summary {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 14px;
  background: #fff;
  color: #24383f;
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

@media (max-width: 680px) {
  .stepper {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
