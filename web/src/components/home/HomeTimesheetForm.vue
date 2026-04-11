<script setup lang="ts">
import { ref, watch } from 'vue';
import type { WeekDay, Project, WorkTypeNode, TimesheetEntry } from '../../types/timesheet';

const props = defineProps<{
  fillableDays: WeekDay[];
  projects: Project[];
  workTypes: WorkTypeNode[];
  selectedProject: Project | null;
  selectedWorkType: WorkTypeNode | null;
  hours: number;
  workContent: string;
  fillDays: number;
  maxFillDays: number;
  entries: TimesheetEntry[];
  entryDates: string[];
  isLoadingProjects: boolean;
  isLoadingWorkTypes: boolean;
  isGenerating: boolean;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  'load-projects': [];
  'select-project': [project: Project];
  'select-work-type': [workType: WorkTypeNode];
  'update:hours': [value: number];
  'update:workContent': [value: string];
  'update:fillDays': [value: number];
  'generate': [];
  'update-entry': [index: number, field: keyof TimesheetEntry, value: string | number];
  'submit': [];
  'reset': [];
}>();

const isExpanded = ref(false);
const showResult = ref(false);
const resultMessage = ref('');
const resultSuccess = ref(false);

const flatWorkTypes = ref<Array<{ node: WorkTypeNode; parent: string }>>([]);

watch(() => props.workTypes, (types) => {
  const result: Array<{ node: WorkTypeNode; parent: string }> = [];
  for (const parent of types) {
    if (parent.children && parent.children.length > 0) {
      for (const child of parent.children) {
        result.push({ node: child, parent: parent.name });
      }
    } else {
      result.push({ node: parent, parent: '' });
    }
  }
  flatWorkTypes.value = result;
}, { immediate: true });

function toggleExpand() {
  if (!isExpanded.value) {
    isExpanded.value = true;
    emit('load-projects');
  } else {
    isExpanded.value = false;
  }
}

function onProjectChange(projectId: string) {
  const project = props.projects.find((p) => p.id === projectId);
  if (project) emit('select-project', project);
}

function onWorkTypeChange(itemId: string) {
  const found = flatWorkTypes.value.find((f) => f.node.id === itemId);
  if (found) emit('select-work-type', found.node);
}

function onGenerate() {
  if (props.fillDays > props.maxFillDays) return;
  emit('generate');
}

function onSubmit() {
  emit('submit');
}

function onUpdateEntry(index: number, field: keyof TimesheetEntry, value: string | number) {
  if (field === 'reportDate') {
    if (!props.entryDates.includes(value as string)) return;
  }
  emit('update-entry', index, field, value);
}

function onReset() {
  emit('reset');
  isExpanded.value = false;
}

function showSubmitResult(success: boolean, message: string) {
  resultSuccess.value = success;
  resultMessage.value = message;
  showResult.value = true;
}

defineExpose({ showSubmitResult });
</script>

<template>
  <section class="timesheet-form">
    <nut-button
      v-if="fillableDays.length > 0 && !isExpanded"
      type="primary"
      block
      @click="toggleExpand"
    >
      填报工时（{{ fillableDays.length }}天）
    </nut-button>

    <template v-if="isExpanded">
      <div class="timesheet-form__header">
        <h3 class="timesheet-form__title">手动填报</h3>
        <nut-button type="default" size="small" @click="onReset">收起</nut-button>
      </div>

      <div class="timesheet-form__body">
        <nut-cell-group>
          <nut-cell title="项目">
            <template #value>
              <select
                class="timesheet-form__select"
                :value="selectedProject?.id || ''"
                @change="onProjectChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>请选择项目</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
              </select>
            </template>
            <template #icon>
              <nut-icon v-if="isLoadingProjects" name="loading" size="16"></nut-icon>
            </template>
          </nut-cell>

          <nut-cell title="工时类型">
            <template #value>
              <select
                class="timesheet-form__select"
                :value="selectedWorkType?.id || ''"
                :disabled="!selectedProject || workTypes.length === 0"
                @change="onWorkTypeChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>请选择工时类型</option>
                <optgroup v-for="group in workTypes" :key="group.id" :label="group.name">
                  <option v-for="child in group.children" :key="child.id" :value="child.id">
                    {{ child.name }}
                  </option>
                </optgroup>
                <option v-for="f in flatWorkTypes.filter((f) => !f.parent)" :key="f.node.id" :value="f.node.id">
                  {{ f.node.name }}
                </option>
              </select>
            </template>
            <template #icon>
              <nut-icon v-if="isLoadingWorkTypes" name="loading" size="16"></nut-icon>
            </template>
          </nut-cell>

          <nut-cell title="工时">
            <template #value>
              <nut-input-number
                :model-value="hours"
                :min="1"
                :max="24"
                @change="(v: number | string) => emit('update:hours', Number(v))"
              />
            </template>
          </nut-cell>

          <nut-cell title="工作内容">
            <template #value>
              <input
                class="timesheet-form__input"
                :value="workContent"
                placeholder="请输入工作内容"
                @input="emit('update:workContent', ($event.target as HTMLInputElement).value)"
              />
            </template>
          </nut-cell>

          <nut-cell title="天数">
            <template #value>
              <nut-input-number
                :model-value="fillDays"
                :min="1"
                :max="maxFillDays"
                @change="(v: number | string) => emit('update:fillDays', Number(v))"
              />
            </template>
          </nut-cell>
        </nut-cell-group>

        <p v-if="fillDays > maxFillDays" class="timesheet-form__warning">
          生成天数不能超过当前可补填的未填天数（{{ maxFillDays }}天）
        </p>

        <nut-button
          type="primary"
          block
          class="timesheet-form__generate-btn"
          :loading="isGenerating"
          :disabled="!selectedProject || !selectedWorkType || fillDays > maxFillDays || fillDays <= 0"
          @click="onGenerate"
        >
          生成工时
        </nut-button>

        <div v-if="entries.length > 0" class="timesheet-form__entries">
          <h4 class="timesheet-form__entries-title">工时明细</h4>
          <div
            v-for="(entry, index) in entries"
            :key="index"
            class="timesheet-form__entry"
          >
            <div class="timesheet-form__entry-row">
              <label class="timesheet-form__entry-label">日期</label>
              <select
                class="timesheet-form__entry-select"
                :value="entry.reportDate"
                @change="onUpdateEntry(index, 'reportDate', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="d in entryDates" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div class="timesheet-form__entry-row">
              <label class="timesheet-form__entry-label">项目</label>
              <span class="timesheet-form__entry-readonly">{{ entry.projectTitle }}</span>
            </div>
            <div class="timesheet-form__entry-row">
              <label class="timesheet-form__entry-label">工时</label>
              <input
                type="number"
                class="timesheet-form__entry-input"
                :value="entry.hours"
                min="1"
                max="24"
                @change="onUpdateEntry(index, 'hours', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="timesheet-form__entry-row">
              <label class="timesheet-form__entry-label">内容</label>
              <input
                class="timesheet-form__entry-input"
                :value="entry.content"
                @change="onUpdateEntry(index, 'content', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <nut-button
            type="success"
            block
            class="timesheet-form__submit-btn"
            :loading="isSubmitting"
            @click="onSubmit"
          >
            提交
          </nut-button>
        </div>
      </div>

      <nut-dialog
        v-model:visible="showResult"
        :title="resultSuccess ? '提交成功' : '提交失败'"
        :close-on-click-overlay="true"
        @ok="showResult = false"
      >
        <p>{{ resultMessage }}</p>
      </nut-dialog>
    </template>
  </section>
</template>

<style scoped>
.timesheet-form {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.timesheet-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.timesheet-form__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.timesheet-form__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timesheet-form__select {
  width: 100%;
  max-width: 200px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  appearance: auto;
}

.timesheet-form__input {
  width: 100%;
  max-width: 200px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
}

.timesheet-form__warning {
  margin: 0;
  font-size: 0.8rem;
  color: #ff4d4f;
}

.timesheet-form__generate-btn {
  margin-top: 0.25rem;
}

.timesheet-form__entries {
  margin-top: 0.5rem;
}

.timesheet-form__entries-title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.timesheet-form__entry {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.timesheet-form__entry-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.timesheet-form__entry-row:last-child {
  margin-bottom: 0;
}

.timesheet-form__entry-label {
  width: 3em;
  font-size: 0.8rem;
  color: #666;
  flex-shrink: 0;
}

.timesheet-form__entry-readonly {
  font-size: 0.8rem;
  color: #333;
}

.timesheet-form__entry-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.8rem;
  min-width: 0;
}

.timesheet-form__entry-select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.8rem;
  background: #fff;
  appearance: auto;
  min-width: 0;
}

.timesheet-form__submit-btn {
  margin-top: 0.5rem;
}
</style>
