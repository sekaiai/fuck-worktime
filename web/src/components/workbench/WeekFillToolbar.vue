<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';
import { buildWorkTypeOptions } from '../../utils/work-types';

const homeStore = useHomeStore();
const { projects, weekFillDefaults, weekTheme, isWeekFillGenerating, editableDates } =
  storeToRefs(homeStore);

const workTypeOptions = computed(() =>
  buildWorkTypeOptions(homeStore.getWorkTypesForProject(weekFillDefaults.value.projectId)),
);

function onProjectChange(event: Event): void {
  void homeStore.setWeekFillDefaultProject((event.target as HTMLSelectElement).value);
}

function onWorkTypeChange(event: Event): void {
  homeStore.setWeekFillDefaultWorkType((event.target as HTMLSelectElement).value);
}

function onHoursInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  homeStore.setWeekFillDefaultHours(Number.isFinite(value) ? value : 0);
}

function onThemeInput(event: Event): void {
  homeStore.setWeekTheme((event.target as HTMLInputElement).value);
}

function onGenerate(): void {
  void homeStore.generateWeekFillForDates(editableDates.value);
}
</script>

<template>
  <section class="wf-toolbar">
    <div class="wf-toolbar__defaults">
      <span class="wf-toolbar__label">项目</span>
      <select :value="weekFillDefaults.projectId" @change="onProjectChange">
        <option value="">选择项目</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.title }}
        </option>
      </select>
      <span class="wf-toolbar__label">类型</span>
      <select
        :value="weekFillDefaults.itemId"
        :disabled="!weekFillDefaults.projectId"
        @change="onWorkTypeChange"
      >
        <option value="">选择工时类型</option>
        <option v-for="option in workTypeOptions" :key="option.id" :value="option.id">
          {{ option.name }}
        </option>
      </select>
      <span class="wf-toolbar__label">工时</span>
      <input type="number" min="0.5" step="0.5" :value="weekFillDefaults.hours" @input="onHoursInput" />
    </div>

    <div class="wf-toolbar__theme">
      <span class="wf-toolbar__label">工作内容</span>
      <input
        type="text"
        placeholder="例如：完成工作台重构与联调"
        :value="weekTheme"
        @input="onThemeInput"
      />
    </div>

    <button
      type="button"
      class="wf-toolbar__generate"
      :disabled="isWeekFillGenerating || editableDates.length === 0"
      @click="onGenerate"
    >
      {{ isWeekFillGenerating ? '生成中…' : `✨ AI 生成待填 ${editableDates.length} 天` }}
    </button>
  </section>
</template>

<style scoped>
.wf-toolbar {
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem 1.1rem;
  background: var(--color-bg-panel-blur);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}

.wf-toolbar__defaults,
.wf-toolbar__theme {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.wf-toolbar__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.wf-toolbar select,
.wf-toolbar input {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

.wf-toolbar__theme input {
  flex: 1;
  min-width: 12rem;
}

.wf-toolbar__generate {
  justify-self: end;
  border: 0;
  border-radius: var(--radius-md);
  padding: 0.55rem 1.1rem;
  background: var(--color-primary);
  color: #fff;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.wf-toolbar__generate:hover:not(:disabled) {
  background: var(--color-primary-strong);
}

.wf-toolbar__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
