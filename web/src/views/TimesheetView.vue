<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useTimesheet } from '../composables/useTimesheet';
import type { TimesheetEntry } from '../api/timesheet';

const router = useRouter();

const {
  projects,
  workTypes,
  selectedProject,
  selectedWorkType,
  weekDates,
  isLoadingProjects,
  isLoadingWorkTypes,
  isSubmitting,
  isGenerating,
  error,
  submitResults,
  hasToken,
  flattenedWorkTypes,
  loadProjects,
  selectProject,
  selectWorkType,
  submitBatch,
  generate,
} = useTimesheet();

const hoursPerDay = ref<number>(8);
const daySelections = ref<boolean[]>(new Array(7).fill(false));
const dayContents = ref<string[]>(new Array(7).fill(''));
const showAiModal = ref(false);
const aiDescription = ref('');
const aiGeneratedContents = shallowRef<string[]>([]);

const selectedDays = computed(() => {
  return weekDates
    .map((day, index) => ({ ...day, index }))
    .filter((day) => daySelections.value[day.index]);
});

const canSubmit = computed(() => {
  return (
    selectedProject.value &&
    selectedWorkType.value &&
    selectedDays.value.length > 0 &&
    selectedDays.value.every((day) => dayContents.value[day.index].trim())
  );
});

onMounted(() => {
  if (hasToken.value) {
    loadProjects();
  }
});

function handleProjectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const project = projects.value.find((p) => p.id === target.value);
  selectProject(project || null);
}

function handleWorkTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const workType = flattenedWorkTypes.value.find((w) => w.id === target.value);
  selectWorkType(workType || null);
}

function toggleDay(index: number) {
  daySelections.value[index] = !daySelections.value[index];
}

function selectAllDays() {
  daySelections.value = new Array(7).fill(true);
}

function clearAllDays() {
  daySelections.value = new Array(7).fill(false);
}

async function handleBatchSubmit() {
  if (!selectedProject.value || !selectedWorkType.value) return;

  const entries: TimesheetEntry[] = selectedDays.value.map((day) => ({
    reportDate: day.date,
    projectId: selectedProject.value!.id,
    projectTitle: selectedProject.value!.title,
    projectStatus: 30,
    itemId: selectedWorkType.value!.id,
    content: dayContents.value[day.index],
    hours: hoursPerDay.value,
  }));

  await submitBatch(entries);
}

function openAiModal() {
  aiDescription.value = '';
  aiGeneratedContents.value = [];
  showAiModal.value = true;
}

function closeAiModal() {
  showAiModal.value = false;
}

async function handleAiGenerate() {
  if (!aiDescription.value.trim()) return;

  const contents = await generate(selectedDays.value.length, aiDescription.value);
  aiGeneratedContents.value = contents;
}

function applyAiContent() {
  selectedDays.value.forEach((day, index) => {
    if (aiGeneratedContents.value[index]) {
      dayContents.value[day.index] = aiGeneratedContents.value[index];
    }
  });
  closeAiModal();
}

function goBack() {
  router.push('/');
}
</script>

<template>
  <main class="timesheet-shell">
    <header class="page-header">
      <button class="back-button" @click="goBack">← 返回首页</button>
      <h1 class="page-title">工时填报</h1>
    </header>

    <div v-if="!hasToken" class="token-warning">
      <p class="warning-text">⚠️ 未设置 Token，请先在首页完成授权</p>
      <button class="warning-action" @click="goBack">前往授权</button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <section class="project-section">
      <h2 class="section-title">项目选择</h2>
      <div class="form-row">
        <label class="form-label">
          <span class="label-text">项目</span>
          <select
            class="form-select"
            :disabled="isLoadingProjects"
            @change="handleProjectChange"
          >
            <option value="">{{ isLoadingProjects ? '加载中...' : '请选择项目' }}</option>
            <option
              v-for="project in projects"
              :key="project.id"
              :value="project.id"
              :selected="selectedProject?.id === project.id"
            >
              {{ project.title }}
            </option>
          </select>
        </label>

        <label class="form-label">
          <span class="label-text">工时类型</span>
          <select
            class="form-select"
            :disabled="isLoadingWorkTypes || !selectedProject"
            @change="handleWorkTypeChange"
          >
            <option value="">
              {{ isLoadingWorkTypes ? '加载中...' : selectedProject ? '请选择工时类型' : '请先选择项目' }}
            </option>
            <option
              v-for="workType in flattenedWorkTypes"
              :key="workType.id"
              :value="workType.id"
              :selected="selectedWorkType?.id === workType.id"
            >
              {{ '　'.repeat(workType.level - 1) }}{{ workType.name }}
            </option>
          </select>
        </label>

        <label class="form-label">
          <span class="label-text">工时/天</span>
          <input
            v-model.number="hoursPerDay"
            type="number"
            class="form-input"
            min="0.5"
            max="24"
            step="0.5"
          />
        </label>
      </div>
    </section>

    <section class="batch-section">
      <header class="batch-header">
        <h2 class="section-title">批量填报</h2>
        <div class="batch-actions">
          <button class="action-btn" @click="selectAllDays">全选</button>
          <button class="action-btn" @click="clearAllDays">清空</button>
        </div>
      </header>

      <ul class="day-list">
        <li v-for="(day, index) in weekDates" :key="day.date" class="day-item">
          <label class="day-checkbox">
            <input
              v-model="daySelections[index]"
              type="checkbox"
              class="checkbox-input"
            />
            <span class="checkbox-label">
              <span class="day-name">{{ day.dayOfWeek }}</span>
              <span class="day-date">{{ day.dayName }}</span>
            </span>
          </label>
          <input
            v-model="dayContents[index]"
            type="text"
            class="day-content-input"
            placeholder="工时内容"
            :disabled="!daySelections[index]"
          />
        </li>
      </ul>

      <div class="submit-area">
        <button
          class="ai-button"
          :disabled="selectedDays.length === 0 || isGenerating"
          @click="openAiModal"
        >
          {{ isGenerating ? '生成中...' : 'AI 生成' }}
        </button>
        <button
          class="submit-button"
          :disabled="!canSubmit || isSubmitting"
          @click="handleBatchSubmit"
        >
          {{ isSubmitting ? '提交中...' : '批量提交' }}
        </button>
      </div>
    </section>

    <section v-if="submitResults.length > 0" class="results-section">
      <h2 class="section-title">提交结果</h2>
      <ul class="result-list">
        <li
          v-for="result in submitResults"
          :key="result.date"
          class="result-item"
          :class="{ success: result.success, failed: !result.success }"
        >
          <span class="result-date">{{ result.date }}</span>
          <span class="result-status">{{ result.message }}</span>
        </li>
      </ul>
    </section>

    <div v-if="showAiModal" class="modal-overlay" @click.self="closeAiModal">
      <div class="modal-content">
        <header class="modal-header">
          <h3 class="modal-title">AI 生成工时内容</h3>
          <button class="modal-close" @click="closeAiModal">×</button>
        </header>

        <div class="modal-body">
          <label class="modal-label">
            <span class="label-text">工作描述</span>
            <textarea
              v-model="aiDescription"
              class="modal-textarea"
              rows="4"
              placeholder="请描述本周的工作内容..."
            ></textarea>
          </label>

          <button
            class="modal-generate-btn"
            :disabled="!aiDescription.trim() || isGenerating"
            @click="handleAiGenerate"
          >
            {{ isGenerating ? '生成中...' : '生成内容' }}
          </button>

          <div v-if="aiGeneratedContents.length > 0" class="generated-content">
            <h4 class="generated-title">生成结果</h4>
            <ul class="generated-list">
              <li v-for="(content, index) in aiGeneratedContents" :key="index" class="generated-item">
                <span class="generated-day">{{ selectedDays[index]?.dayOfWeek }}:</span>
                <span class="generated-text">{{ content }}</span>
              </li>
            </ul>
            <button class="apply-btn" @click="applyAiContent">应用到表单</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.timesheet-shell {
  width: min(1040px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 1rem;
  padding: 0.85rem 0.75rem 1.4rem;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  border: 1px solid #d2e0da;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #163932;
  font-size: 0.88rem;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
}

.back-button:hover {
  background: #f7fbf9;
}

.page-title {
  margin: 0;
  color: #163932;
  font-size: 1.25rem;
  font-weight: 700;
}

.token-warning {
  border: 1px solid #e6c890;
  border-radius: 0.75rem;
  background: #fff9e6;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.warning-text {
  margin: 0;
  color: #8b6914;
  font-size: 0.9rem;
}

.warning-action {
  border: none;
  border-radius: 0.5rem;
  background: #d4a418;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.error-message {
  border: 1px solid #e8a0a0;
  border-radius: 0.75rem;
  background: #fff0f0;
  padding: 0.85rem;
  color: #c04040;
  font-size: 0.9rem;
}

.section-title {
  margin: 0 0 0.75rem;
  color: #163932;
  font-size: 1rem;
  font-weight: 700;
}

.project-section {
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.form-row {
  display: grid;
  gap: 0.85rem;
}

.form-label {
  display: grid;
  gap: 0.35rem;
}

.label-text {
  color: #21443d;
  font-size: 0.85rem;
  font-weight: 600;
}

.form-select,
.form-input {
  border: 1px solid #c8d9d2;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #163932;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #145848;
}

.form-select:disabled,
.form-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.batch-section {
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.batch-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  border: 1px solid #c8d9d2;
  border-radius: 0.4rem;
  background: #ffffff;
  color: #21443d;
  font-size: 0.82rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}

.action-btn:hover {
  background: #f7fbf9;
}

.day-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.6rem;
}

.day-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: center;
}

.day-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-input {
  width: 1.1rem;
  height: 1.1rem;
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.day-name {
  color: #163932;
  font-size: 0.88rem;
  font-weight: 600;
}

.day-date {
  color: #607a72;
  font-size: 0.78rem;
}

.day-content-input {
  border: 1px solid #c8d9d2;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #163932;
  font-size: 0.88rem;
  padding: 0.55rem 0.7rem;
}

.day-content-input:focus {
  outline: none;
  border-color: #145848;
}

.day-content-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.submit-area {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
}

.ai-button {
  border: 1px solid #145848;
  border-radius: 0.75rem;
  background: #ffffff;
  color: #145848;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
}

.ai-button:hover:not(:disabled) {
  background: #f0f7f5;
}

.ai-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-button {
  border: none;
  border-radius: 0.75rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
}

.submit-button:hover:not(:disabled) {
  background: #0f3d32;
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results-section {
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.result-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.result-item {
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.result-item.success {
  background: #e6f7ed;
  border: 1px solid #a8e0bc;
}

.result-item.failed {
  background: #fff0f0;
  border: 1px solid #e8a0a0;
}

.result-date {
  color: #21443d;
  font-size: 0.88rem;
  font-weight: 600;
}

.result-status {
  color: #55716a;
  font-size: 0.85rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.modal-content {
  width: min(500px, 100%);
  border-radius: 1rem;
  background: #ffffff;
  padding: 1.25rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-title {
  margin: 0;
  color: #163932;
  font-size: 1.1rem;
  font-weight: 700;
}

.modal-close {
  border: none;
  background: transparent;
  color: #607a72;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.modal-body {
  display: grid;
  gap: 0.85rem;
}

.modal-label {
  display: grid;
  gap: 0.35rem;
}

.modal-textarea {
  border: 1px solid #c8d9d2;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #163932;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  resize: vertical;
  font-family: inherit;
}

.modal-textarea:focus {
  outline: none;
  border-color: #145848;
}

.modal-generate-btn {
  border: none;
  border-radius: 0.6rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.65rem 1rem;
  cursor: pointer;
}

.modal-generate-btn:hover:not(:disabled) {
  background: #0f3d32;
}

.modal-generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.generated-content {
  border: 1px solid #d2e0da;
  border-radius: 0.75rem;
  background: #f7fbf9;
  padding: 0.85rem;
  display: grid;
  gap: 0.6rem;
}

.generated-title {
  margin: 0;
  color: #163932;
  font-size: 0.95rem;
  font-weight: 600;
}

.generated-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.generated-item {
  color: #21443d;
  font-size: 0.88rem;
  line-height: 1.5;
}

.generated-day {
  font-weight: 600;
  margin-right: 0.5rem;
}

.generated-text {
  color: #2b4a43;
}

.apply-btn {
  border: none;
  border-radius: 0.6rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.55rem 1rem;
  cursor: pointer;
}

.apply-btn:hover {
  background: #0f3d32;
}

@media (min-width: 768px) {
  .form-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 900px) {
  .timesheet-shell {
    padding: 1.2rem 1rem 2rem;
  }

  .project-section,
  .batch-section,
  .results-section {
    padding: 1.1rem;
  }
}
</style>
