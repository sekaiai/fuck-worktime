<script setup lang="ts">
import { computed, watch } from 'vue';
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

/**
 * 只读行名称解析（三级兜底，保证不空白）：
 * 后端名称字段 → 项目目录/工时类型树反查 → 原始 ID。
 * 工时类型反查依赖 workTypeMap[projectId]，只读行通常未加载，见下方按需补载。
 */
const resolvedProjectName = computed(() => {
  const { projectId, projectTitle } = props.row;
  return projectTitle || projects.value.find((project) => project.id === projectId)?.title || projectId;
});

const resolvedItemName = computed(() => {
  const { itemId, itemName } = props.row;
  return itemName || workTypeOptions.value.find((option) => option.id === itemId)?.name || itemId;
});

watch(
  () => [props.readOnly, props.row.projectId] as const,
  ([readOnly, projectId]) => {
    if (!readOnly || !projectId) {
      return;
    }

    // 项目树未加载时补载；session 缓存保证多行同项目只请求一次
    if (homeStore.getWorkTypesForProject(projectId).length === 0) {
      void homeStore.loadWorkTypesByProject(projectId);
    }
  },
  { immediate: true },
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

    <!-- 只读行四个字段统一为同款浅底文本块；编辑行保持输入控件 -->
    <span
      v-if="props.readOnly"
      class="wf-row__text"
      :title="resolvedProjectName"
    >{{ resolvedProjectName }}</span>
    <select
      v-else
      class="wf-row__select"
      :value="row.projectId"
      :disabled="isLocked"
      @change="onProjectChange"
    >
      <option value="">选择项目</option>
      <option v-for="project in projects" :key="project.id" :value="project.id">
        {{ project.title }}
      </option>
    </select>

    <span
      v-if="props.readOnly"
      class="wf-row__text"
      :title="resolvedItemName"
    >{{ resolvedItemName }}</span>
    <select
      v-else
      class="wf-row__select"
      :value="row.itemId"
      :disabled="!row.projectId || isLocked"
      @change="onWorkTypeChange"
    >
      <option value="">选择工时类型</option>
      <option v-for="option in workTypeOptions" :key="option.id" :value="option.id">
        {{ option.name }}
      </option>
    </select>

    <span v-if="props.readOnly" class="wf-row__text">{{ row.hours }}h</span>
    <input
      v-else
      class="wf-row__hours"
      type="number"
      min="0.5"
      step="0.5"
      :max="homeStore.getWeekFillMaxHoursForRow(props.row.rowId)"
      :value="row.hours"
      :disabled="isLocked"
      @input="onHoursInput"
    />

    <span v-if="props.readOnly" class="wf-row__text wf-row__text--content">{{ row.content }}</span>
    <textarea
      v-else
      class="wf-row__content"
      rows="1"
      maxlength="200"
      placeholder="工作内容"
      :value="row.content"
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

/* 只读行的名称文本：与 select 同尺寸占位，保证网格对齐 */
.wf-row__text {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  /* 极浅底色仅作只读示意，不干扰阅读 */
  background: color-mix(in srgb, var(--color-bg-soft) 40%, white);
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

/* 只读工作内容：保留原文换行 */
.wf-row__text--content {
  display: block;
  white-space: pre-wrap;
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

  /* 防 iOS Safari 聚焦放大：控件字号 ≥ 16px */
  .wf-row__select,
  .wf-row__hours,
  .wf-row__content,
  .wf-row__text {
    font-size: 1rem;
  }

  /* 触控目标 ≥ 36px */
  .wf-row__actions button {
    min-height: 36px;
    padding: 0.45rem 0.6rem;
    font-size: 0.82rem;
  }
}
</style>
