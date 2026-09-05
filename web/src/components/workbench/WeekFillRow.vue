<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import type { WeekFillDraftRow } from '../../types/week-fill';
import { buildWorkTypeOptions } from '../../utils/work-types';
import { isRejectedTimesheetStatus } from '../../utils/timesheet-status';

interface WeekFillRowProps {
  row: WeekFillDraftRow;
  errorMessage: string;
  readOnly?: boolean;
}

const props = withDefaults(defineProps<WeekFillRowProps>(), {
  readOnly: false,
});

const homeStore = useHomeStore();
const {
  projects,
  isWeekFillGenerating,
  isWeekFillSubmitting,
  weekFillDeletingRowIds,
  weekFillSubmittingRowIds,
} = storeToRefs(homeStore);

const isDeleting = computed(() => weekFillDeletingRowIds.value.includes(props.row.rowId));
const isSubmitting = computed(() => weekFillSubmittingRowIds.value.includes(props.row.rowId));
const isLocked = computed(() => isDeleting.value || isSubmitting.value || isWeekFillSubmitting.value);
/** 驳回明细的 statusDesc 是驳回原因，展示时使用更明确的标签 */
const isRejected = computed(() =>
  isRejectedTimesheetStatus(props.row.status ?? '', props.row.statusDesc ?? ''),
);

/** 二级工时类型拍平：一级节点若无子节点则自身可选 */
const workTypeOptions = computed(() =>
  buildWorkTypeOptions(homeStore.getWorkTypesForProject(props.row.projectId)),
);

function onProjectChange(event: Event): void {
  void homeStore.setWeekFillRowProject(props.row.rowId, (event.target as HTMLSelectElement).value);
}

function onWorkTypeChange(event: Event): void {
  homeStore.setWeekFillRowWorkType(props.row.rowId, (event.target as HTMLSelectElement).value);
}

function onHoursInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  homeStore.setWeekFillRowHours(props.row.rowId, Number.isFinite(value) ? value : 0);
}

function onContentInput(event: Event): void {
  homeStore.setWeekFillRowContent(props.row.rowId, (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="wf-row" :class="{ 'wf-row--error': errorMessage }">
    <div v-if="row.period || row.status || row.statusDesc" class="wf-row__meta">
      <span v-if="row.period">期间：{{ row.period }}</span>
      <span v-if="row.status">状态：{{ row.status }}</span>
      <span v-if="row.statusDesc && row.statusDesc !== row.status">
        {{ isRejected ? '驳回原因' : '状态说明' }}：{{ row.statusDesc }}
      </span>
    </div>

    <select
      class="wf-row__select"
      :value="row.projectId"
      :disabled="props.readOnly || isLocked"
      @change="onProjectChange"
    >
      <option value="">选择项目</option>
      <option v-for="project in projects" :key="project.id" :value="project.id">
        {{ project.title }}
      </option>
    </select>

    <select
      class="wf-row__select"
      :value="row.itemId"
      :disabled="props.readOnly || !row.projectId || isLocked"
      @change="onWorkTypeChange"
    >
      <option value="">选择工时类型</option>
      <option v-for="option in workTypeOptions" :key="option.id" :value="option.id">
        {{ option.name }}
      </option>
    </select>

    <input
      class="wf-row__hours"
      type="number"
      min="0.5"
      step="0.5"
      :max="props.readOnly ? undefined : homeStore.getWeekFillMaxHoursForRow(props.row.rowId)"
      :value="row.hours"
      :readonly="props.readOnly"
      :disabled="isLocked"
      @input="onHoursInput"
    />

    <textarea
      class="wf-row__content"
      rows="1"
      maxlength="200"
      placeholder="工作内容"
      :value="row.content"
      :readonly="props.readOnly"
      :disabled="isLocked"
      @input="onContentInput"
    ></textarea>

    <!-- 只读行传入 action 插槽（如撤回按钮）时也渲染操作区，使扩展操作与编辑操作同位 -->
    <div v-if="!props.readOnly || $slots.action" class="wf-row__actions">
      <template v-if="!props.readOnly">
        <button
          type="button"
          title="AI 重新生成本行"
          :disabled="isWeekFillGenerating || isLocked"
          @click="homeStore.regenerateWeekFillRow(row.rowId)"
        >✨</button>
      
        <button
          type="button"
          title="单独提交本行"
          :disabled="isLocked"
          @click="void homeStore.submitWeekFillRow(row.rowId)"
        >
          {{ isSubmitting ? '提交中…' : '单独提交' }}
        </button>
        <button type="button" title="删除本行" :disabled="isLocked" @click="void homeStore.removeWeekFillRow(row.rowId)">
          {{ isDeleting ? '删除中…' : '删除' }}
        </button>
      </template>
      <slot name="action" />
    </div>

    <p v-if="errorMessage" class="wf-row__error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.wf-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) 5rem minmax(0, 2fr) auto;
  gap: 0.5rem;
  align-items: start;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
}

.wf-row__meta {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.wf-row--error {
  border-color: var(--color-danger);
}

.wf-row__select,
.wf-row__hours,
.wf-row__content {
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--color-text-primary);
}

.wf-row__content {
  resize: vertical;
  line-height: 1.5;
}

.wf-row__actions {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.wf-row__actions button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.5rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
}

.wf-row__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wf-row__error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-danger);
  font-size: 0.75rem;
}

/* 窄屏堆叠（spec §14.3） */
@media (max-width: 767px) {
  .wf-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
