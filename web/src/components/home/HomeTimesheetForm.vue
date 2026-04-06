<script setup lang="ts">
import { ref, computed } from 'vue';
import type { WorkDay } from '../../composables/useWeeklyReportMock';

interface TimesheetEntry {
  date: string;
  dayOfWeek: string;
  project: string;
  workType: string;
  hours: number;
  content: string;
}

interface Props {
  unfilledDays: readonly WorkDay[];
}

interface Emits {
  (event: 'close'): void;
  (event: 'submit', entries: TimesheetEntry[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const PROJECT_OPTIONS = [
  '民政厅小程序',
  '三化四账',
  '政务数据平台',
  '运维服务',
  '其他项目',
] as const;

const WORK_TYPE_OPTIONS = ['正常工作', '加班', '出差', '培训', '其他'] as const;

const entries = ref<TimesheetEntry[]>(
  props.unfilledDays.map((day) => ({
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    project: '',
    workType: '正常工作',
    hours: 8,
    content: '',
  })),
);

const globalSettings = ref({
  project: '',
  workType: '正常工作',
  hours: 8,
});

const hasUnfilledEntries = computed(() =>
  entries.value.some((entry) => !entry.project || entry.hours <= 0),
);

const applyGlobalSettings = () => {
  if (globalSettings.value.project) {
    entries.value.forEach((entry) => {
      entry.project = globalSettings.value.project;
    });
  }
  if (globalSettings.value.workType) {
    entries.value.forEach((entry) => {
      entry.workType = globalSettings.value.workType;
    });
  }
  if (globalSettings.value.hours > 0) {
    entries.value.forEach((entry) => {
      entry.hours = globalSettings.value.hours;
    });
  }
};

const close = () => {
  emit('close');
};

const submit = () => {
  const validEntries = entries.value.filter((entry) => entry.project && entry.hours > 0);
  if (validEntries.length > 0) {
    emit('submit', validEntries);
  }
};
</script>

<template>
  <section class="timesheet-form" aria-label="工时填报表单">
    <header class="form-header">
      <h2 class="form-title">工时填报</h2>
      <button class="close-button" @click="close" aria-label="关闭">✕</button>
    </header>

    <div class="global-settings">
      <h3 class="settings-title">全局设置</h3>
      <div class="settings-row">
        <label class="settings-label">
          <span class="label-text">项目</span>
          <select v-model="globalSettings.project" class="settings-select">
            <option value="">请选择项目</option>
            <option v-for="project in PROJECT_OPTIONS" :key="project" :value="project">
              {{ project }}
            </option>
          </select>
        </label>

        <label class="settings-label">
          <span class="label-text">工时类型</span>
          <select v-model="globalSettings.workType" class="settings-select">
            <option v-for="type in WORK_TYPE_OPTIONS" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </label>

        <label class="settings-label">
          <span class="label-text">工时</span>
          <input
            v-model.number="globalSettings.hours"
            type="number"
            min="0"
            max="24"
            class="settings-input"
          />
        </label>

        <button class="apply-button" @click="applyGlobalSettings">应用到全部</button>
      </div>
    </div>

    <div class="entries-list">
      <div v-for="(entry, index) in entries" :key="entry.date" class="entry-card">
        <header class="entry-header">
          <span class="entry-date">{{ entry.dayOfWeek }} · {{ entry.date }}</span>
        </header>

        <div class="entry-fields">
          <label class="field-label">
            <span class="field-text">项目</span>
            <select v-model="entry.project" class="field-select">
              <option value="">请选择项目</option>
              <option v-for="project in PROJECT_OPTIONS" :key="project" :value="project">
                {{ project }}
              </option>
            </select>
          </label>

          <label class="field-label">
            <span class="field-text">工时类型</span>
            <select v-model="entry.workType" class="field-select">
              <option v-for="type in WORK_TYPE_OPTIONS" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </label>

          <label class="field-label">
            <span class="field-text">工时</span>
            <input
              v-model.number="entry.hours"
              type="number"
              min="0"
              max="24"
              class="field-input"
            />
          </label>
        </div>

        <label class="content-label">
          <span class="field-text">工作内容</span>
          <textarea
            v-model="entry.content"
            class="content-textarea"
            placeholder="请输入工作内容描述"
            rows="2"
          ></textarea>
        </label>
      </div>
    </div>

    <footer class="form-footer">
      <button class="cancel-button" @click="close">取消</button>
      <button
        class="submit-button"
        :disabled="hasUnfilledEntries"
        @click="submit"
      >
        提交填报
      </button>
    </footer>
  </section>
</template>

<style scoped>
.timesheet-form {
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.9rem;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.form-title {
  margin: 0;
  color: #163932;
  font-size: 1.1rem;
}

.close-button {
  border: none;
  background: transparent;
  color: #607a72;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem;
}

.close-button:hover {
  color: #163932;
}

.global-settings {
  background: #f7fbf9;
  border: 1px solid #d8e5df;
  border-radius: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.settings-title {
  margin: 0 0 0.5rem;
  color: #21443d;
  font-size: 0.9rem;
}

.settings-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  align-items: end;
}

.settings-label {
  display: grid;
  gap: 0.25rem;
}

.label-text {
  color: #4f6b64;
  font-size: 0.78rem;
}

.settings-select,
.settings-input {
  border: 1px solid #c2d8ce;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.45rem 0.5rem;
  font-size: 0.85rem;
  color: #295149;
}

.apply-button {
  grid-column: 1 / -1;
  border: 1px solid #2d7d67;
  border-radius: 0.5rem;
  background: #2d7d67;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.45rem;
  margin-top: 0.25rem;
}

.entries-list {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.entry-card {
  border: 1px solid #d8e5df;
  border-radius: 0.75rem;
  background: #fbfefd;
  padding: 0.65rem;
}

.entry-header {
  margin-bottom: 0.5rem;
}

.entry-date {
  color: #21443d;
  font-size: 0.88rem;
  font-weight: 700;
}

.entry-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.field-label {
  display: grid;
  gap: 0.2rem;
}

.field-text {
  color: #4f6b64;
  font-size: 0.75rem;
}

.field-select,
.field-input {
  border: 1px solid #c2d8ce;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.35rem 0.4rem;
  font-size: 0.82rem;
  color: #295149;
}

.content-label {
  display: grid;
  gap: 0.2rem;
}

.content-textarea {
  border: 1px solid #c2d8ce;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.35rem 0.4rem;
  font-size: 0.82rem;
  color: #295149;
  resize: vertical;
  font-family: inherit;
}

.form-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.cancel-button {
  border: 1px solid #c2d8ce;
  border-radius: 0.65rem;
  background: #f4faf7;
  color: #295149;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.55rem;
}

.submit-button {
  border: none;
  border-radius: 0.65rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.55rem;
}

.submit-button:disabled {
  background: #a8c5bc;
  cursor: not-allowed;
}

@media (min-width: 900px) {
  .timesheet-form {
    padding: 1.1rem;
  }

  .settings-row {
    grid-template-columns: 1fr 1fr 1fr auto;
    align-items: end;
  }

  .apply-button {
    grid-column: auto;
    margin-top: 0;
    min-width: 100px;
  }

  .entry-fields {
    grid-template-columns: 1fr 1fr 0.8fr;
  }
}
</style>
