<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import type { WeekFillDraftRow } from '../../types/week-fill';

const props = defineProps<{
  row: WeekFillDraftRow;
  errorMessage: string;
}>();

const homeStore = useHomeStore();
const { projects, isWeekFillGenerating } = storeToRefs(homeStore);

/** 二级工时类型拍平：一级节点若无子节点则自身可选 */
const workTypeOptions = computed(() => {
  const nodes = homeStore.getWorkTypesForProject(props.row.projectId);
  return nodes.flatMap((node) =>
    node.children?.length
      ? node.children.map((child) => ({ id: child.id, name: `${node.name} / ${child.name}` }))
      : [{ id: node.id, name: node.name }],
  );
});

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
    <select class="wf-row__select" :value="row.projectId" @change="onProjectChange">
      <option value="">选择项目</option>
      <option v-for="project in projects" :key="project.id" :value="project.id">
        {{ project.title }}
      </option>
    </select>

    <select
      class="wf-row__select"
      :value="row.itemId"
      :disabled="!row.projectId"
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
      :value="row.hours"
      @input="onHoursInput"
    />

    <textarea
      class="wf-row__content"
      rows="1"
      maxlength="200"
      placeholder="工作内容"
      :value="row.content"
      @input="onContentInput"
    ></textarea>

    <div class="wf-row__actions">
      <button
        type="button"
        title="AI 重新生成本行"
        :disabled="isWeekFillGenerating"
        @click="homeStore.regenerateWeekFillRow(row.rowId)"
      >✨</button>
      <button type="button" title="复制本行" @click="homeStore.duplicateWeekFillRow(row.rowId)">
        复制
      </button>
      <button type="button" title="删除本行" @click="homeStore.removeWeekFillRow(row.rowId)">
        删除
      </button>
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
  border-radius: 12px;
  background: var(--color-bg-panel);
}

.wf-row--error {
  border-color: #dc4c42;
}

.wf-row__select,
.wf-row__hours,
.wf-row__content {
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
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
  border-radius: 10px;
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
  color: #dc4c42;
  font-size: 0.75rem;
}

/* 窄屏堆叠（spec §14.3） */
@media (max-width: 767px) {
  .wf-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
