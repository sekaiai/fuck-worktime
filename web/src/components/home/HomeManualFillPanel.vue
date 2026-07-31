<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import { useHomeStore } from '../../stores/home';
import { formatDisplayDate } from '../../utils/date';
import type { TimesheetEntry } from '../../types/timesheet';

const homeStore = useHomeStore();
const {
  isManualFillVisible,
  projects,
  isProjectsLoading,
  manualProjectId,
  manualWorkTypeGroupId,
  manualWorkTypeId,
  manualHours,
  manualWork,
  manualDaysToGenerate,
  manualEntries,
  isGenerating,
  isSubmitting,
  manualToastMessage,
  manualResultDialog,
  manualCurrentStep,
  compactReviewMode,
  manualMaxFillDays,
  sortedFillableDays,
  manualWorkTypeGroups,
  manualSelectedWorkType,
  manualAvailableWorkTypes,
  manualPreviewDates,
} = storeToRefs(homeStore);

const stepSummary = computed(() => {
  if (manualCurrentStep.value === 1) {
    return '先选择项目、工时类型和待补填天数。';
  }
  if (manualCurrentStep.value === 2) {
    return '输入工作主题后，系统会按天生成可提交描述。';
  }
  const totalEntryHours = manualEntries.value.reduce((sum: number, entry: TimesheetEntry) => sum + entry.hours, 0);
  return `本次共 ${manualEntries.value.length} 条记录，预计提交 ${totalEntryHours} 小时。`;
});
</script>

<template>
  <section v-if="isManualFillVisible" class="manual-panel">
    <header class="manual-panel__header">
      <div>
        <p class="manual-panel__eyebrow">Manual Fill</p>
        <h2 class="manual-panel__title">批量补填未提交工时</h2>
      </div>
      <button class="manual-panel__close" type="button" @click="homeStore.closeManualFill()">收起</button>
    </header>

    <div v-if="manualMaxFillDays === 0" class="manual-panel__state">当前这周没有可补填的工作日。</div>
    <template v-else>
      <div class="manual-panel__intro">
        <p class="manual-panel__copy">{{ stepSummary }}</p>
        <div class="manual-panel__dates">
          <span>待处理日期</span>
          <strong v-for="day in manualPreviewDates" :key="day.date">{{ formatDisplayDate(day.date) }}</strong>
        </div>
      </div>

      <div class="manual-panel__stepper">
        <button type="button" :class="{ active: manualCurrentStep === 1 }" @click="homeStore.setManualCurrentStep(1)">
          1. 选择类型
        </button>
        <button type="button" :class="{ active: manualCurrentStep === 2 }" @click="homeStore.setManualCurrentStep(2)">
          2. 生成内容
        </button>
        <button type="button" :class="{ active: manualCurrentStep === 3 }" @click="homeStore.setManualCurrentStep(3)">
          3. 核对提交
        </button>
      </div>

      <div v-show="manualCurrentStep === 1" class="manual-panel__form">
        <label class="field">
          <span>项目</span>
          <select :value="manualProjectId" @change="homeStore.setManualProject(($event.target as HTMLSelectElement).value)">
            <option value="">请选择项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select>
        </label>

        <label class="field">
          <span>一级工时类型</span>
          <select
            :value="manualWorkTypeGroupId"
            :disabled="manualWorkTypeGroups.length === 0"
            @change="homeStore.setManualWorkTypeGroup(($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择一级类型</option>
            <option v-for="group in manualWorkTypeGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>二级工时类型</span>
          <select
            :value="manualWorkTypeId"
            :disabled="manualAvailableWorkTypes.length === 0"
            @change="homeStore.setManualWorkType(($event.target as HTMLSelectElement).value)"
          >
            <option value="">请选择二级类型</option>
            <option v-for="item in manualAvailableWorkTypes" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>工时</span>
          <input
            :value="manualHours"
            type="number"
            min="1"
            max="24"
            @input="homeStore.setManualHours(Number(($event.target as HTMLInputElement).value))"
          />
        </label>

        <label class="field">
          <span>生成天数</span>
          <input
            :value="manualDaysToGenerate"
            type="number"
            min="1"
            :max="manualMaxFillDays"
            @input="homeStore.setManualDaysToGenerate(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </div>

      <label v-show="manualCurrentStep === 2" class="manual-panel__block-field field">
        <span>工作内容主题</span>
        <textarea
          :value="manualWork"
          rows="4"
          placeholder="输入工作内容主题，系统会为每天生成适合提交的描述"
          @input="homeStore.setManualWork(($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <p v-show="manualCurrentStep === 2 && manualDaysToGenerate > manualMaxFillDays" class="manual-panel__warning">
        生成天数不能超过当前可补填的未填天数。
      </p>

      <div v-show="manualCurrentStep === 2" class="manual-panel__inline-actions">
        <button
          class="manual-panel__primary"
          type="button"
          :disabled="isGenerating || isProjectsLoading"
          @click="homeStore.generateManualEntries()"
        >
          {{ isGenerating ? '生成中...' : '生成工时描述' }}
        </button>
        <span v-if="isProjectsLoading" class="manual-panel__helper">正在获取项目列表...</span>
      </div>

      <div v-show="manualCurrentStep === 3 && manualEntries.length > 0" class="manual-panel__entry-list">
        <label class="manual-panel__compact-switch">
          <input
            :checked="compactReviewMode"
            type="checkbox"
            @change="homeStore.setCompactReviewMode(($event.target as HTMLInputElement).checked)"
          />
          <span>简化校对模式，仅检查日期与摘要</span>
        </label>

        <article
          v-for="(entry, index) in manualEntries"
          :key="`${entry.reportDate}-${index}`"
          class="manual-panel__entry-card"
        >
          <label class="field">
            <span>日期</span>
            <select
              :value="entry.reportDate"
              @change="homeStore.updateManualEntryDate(index, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="day in sortedFillableDays" :key="day.date" :value="day.date">
                {{ formatDisplayDate(day.date) }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>项目</span>
            <input :value="entry.projectTitle" disabled />
          </label>
          <label class="field">
            <span>工时类型</span>
            <input :value="entry.itemName || manualSelectedWorkType?.name || ''" disabled />
          </label>

          <template v-if="compactReviewMode">
            <p class="manual-panel__entry-summary">{{ entry.hours }}h / {{ entry.content }}</p>
          </template>
          <template v-else>
            <label class="field">
              <span>工时</span>
              <input
                :value="entry.hours"
                type="number"
                min="1"
                max="24"
                @input="homeStore.updateManualEntryHours(index, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="manual-panel__entry-content field">
              <span>内容</span>
              <textarea
                :value="entry.content"
                rows="3"
                @input="homeStore.updateManualEntryContent(index, ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </template>
        </article>

        <button class="manual-panel__primary" type="button" :disabled="isSubmitting" @click="homeStore.submitManualEntries()">
          {{ isSubmitting ? '提交中...' : '提交补填工时' }}
        </button>
      </div>

      <div class="manual-panel__inline-actions">
        <button
          class="manual-panel__secondary"
          type="button"
          :disabled="manualCurrentStep === 1"
          @click="homeStore.setManualCurrentStep((manualCurrentStep - 1) as 1 | 2 | 3)"
        >
          上一步
        </button>
        <button
          class="manual-panel__primary"
          type="button"
          :disabled="manualCurrentStep === 3"
          @click="homeStore.setManualCurrentStep((manualCurrentStep + 1) as 1 | 2 | 3)"
        >
          下一步
        </button>
      </div>
    </template>

    <InlineToast :message="manualToastMessage" />
    <ResultDialog
      :open="manualResultDialog.open"
      :title="manualResultDialog.title"
      :message="manualResultDialog.message"
      @close="homeStore.closeManualResultDialog()"
    />
  </section>
</template>

<style scoped>
.manual-panel {
  position: relative;
  display: grid;
  gap: 1rem;
  border-radius: var(--radius-2xl);
  padding: 1.25rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.manual-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.manual-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.manual-panel__title {
  font-size: clamp(1.7rem, 4vw, 2.2rem);
}

.manual-panel__close,
.manual-panel__primary,
.manual-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
  transition: opacity 180ms ease;
}

.manual-panel__close:disabled,
.manual-panel__primary:disabled,
.manual-panel__secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.manual-panel__close,
.manual-panel__secondary {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
}

.manual-panel__primary {
  background: var(--color-primary);
  color: #ffffff;
}

.manual-panel__intro {
  display: grid;
  gap: 0.8rem;
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
}

.manual-panel__copy,
.manual-panel__helper {
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.manual-panel__dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.manual-panel__dates span {
  color: var(--color-text-tertiary);
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
  background: var(--color-bg-soft);
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
  border-radius: var(--radius-lg);
  min-height: 3.3rem;
  padding: 0.8rem;
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
  cursor: pointer;
}

.manual-panel__stepper button.active {
  background: var(--color-primary);
  color: #ffffff;
}

.manual-panel__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
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
  color: var(--color-danger);
}

.manual-panel__compact-switch {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
}

.manual-panel__compact-switch span {
  font-family: var(--font-body);
  font-size: 0.9rem;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--color-text-secondary);
}

.manual-panel__entry-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
  padding: 1rem;
  border-radius: var(--radius-xl);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
}

.manual-panel__entry-summary {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-lg);
  background: var(--color-bg-soft);
  line-height: 1.65;
}

.manual-panel__entry-content {
  grid-column: 1 / -1;
}

.manual-panel__state {
  border-radius: var(--radius-xl);
  padding: 1rem;
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
}

@media (max-width: 960px) {
  .manual-panel__form,
  .manual-panel__entry-card {
    grid-template-columns: 1fr;
  }
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
