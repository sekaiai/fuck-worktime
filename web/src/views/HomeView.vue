<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import HomeUserInfo from '../components/home/HomeUserInfo.vue';
import HomeWeekTimeline from '../components/home/HomeWeekTimeline.vue';
import HomeTimesheetForm from '../components/home/HomeTimesheetForm.vue';
import HomeAutoFillForm from '../components/home/HomeAutoFillForm.vue';
import HomeNotifyEntry from '../components/home/HomeNotifyEntry.vue';
import { useAuth } from '../composables/useAuth';
import { useWeeklyReport } from '../composables/useWeeklyReport';
import { useTimesheetForm } from '../composables/useTimesheetForm';
import { useAutoFill } from '../composables/useAutoFill';

const {
  userId,
  userInfo,
  isLoading: isAuthLoading,
  restoreAuth,
  logout,
} = useAuth();

const {
  days,
  fillableDays,
  totalHours,
  workDays,
  averageHours,
  isLoading: isReportLoading,
  error: reportError,
  loadWeek,
  refresh: refreshReport,
} = useWeeklyReport();

const form = useTimesheetForm(userId);

const {
  projects,
  workTypes,
  selectedProject,
  selectedWorkType,
  hours,
  workContent,
  fillDays,
  maxFillDays,
  entries,
  entryDates,
  isLoadingProjects,
  isLoadingWorkTypes,
  isGenerating,
  isSubmitting,
  loadProjects,
  selectProject,
  selectWorkType,
  updateEntry,
  reset: resetForm,
  generate,
  submit,
} = form;

function setHours(v: number): void { hours.value = v; }
function setWorkContent(v: string): void { workContent.value = v; }
function setFillDays(v: number): void { fillDays.value = v; }

const {
  config: autoFillConfig,
  status: autoFillStatus,
  deadlineDisplay,
  isLoading: isAutoFillLoading,
  isSaving: isAutoFillSaving,
  isDisabling: isAutoFillDisabling,
  loadConfig: loadAutoFillConfig,
  save: saveAutoFill,
  disable: disableAutoFill,
} = useAutoFill(userId);

const autoFillEnabled = computed(() => autoFillStatus.value === 'enabled');

const timesheetFormRef = ref<InstanceType<typeof HomeTimesheetForm> | null>(null);
const autoFillFormRef = ref<InstanceType<typeof HomeAutoFillForm> | null>(null);

async function handleLogout() {
  logout();
}

async function handleGenerate() {
  await generate(fillableDays.value);
}

async function handleSubmit() {
  const result = await submit();
  timesheetFormRef.value?.showSubmitResult(result.success, result.message);
  if (result.success) {
    await refreshReport();
  }
}

async function handleAutoFillSave(config: Parameters<typeof saveAutoFill>[0]) {
  const result = await saveAutoFill(config);
  autoFillFormRef.value?.showSaveResult(result.success, result.message);
}

async function handleAutoFillDisable() {
  const result = await disableAutoFill();
  autoFillFormRef.value?.showSaveResult(result.success, result.message);
}

onMounted(async () => {
  const authed = await restoreAuth();
  if (authed) {
    await Promise.all([
      loadWeek(),
      loadAutoFillConfig(),
    ]);
  }
});
</script>

<template>
  <main class="home">
    <div class="home__container">
      <HomeUserInfo
        :user-info="userInfo"
        :is-loading="isAuthLoading"
        @logout="handleLogout"
      />

      <HomeWeekTimeline
        :days="days"
        :total-hours="totalHours"
        :work-days="workDays"
        :average-hours="averageHours"
        :is-loading="isReportLoading"
        :error="reportError"
        @refresh="refreshReport"
      />

      <HomeTimesheetForm
        ref="timesheetFormRef"
        :fillable-days="fillableDays"
        :projects="projects"
        :work-types="workTypes"
        :selected-project="selectedProject"
        :selected-work-type="selectedWorkType"
        :hours="hours"
        :work-content="workContent"
        :fill-days="fillDays"
        :max-fill-days="maxFillDays"
        :entries="entries"
        :entry-dates="entryDates"
        :is-loading-projects="isLoadingProjects"
        :is-loading-work-types="isLoadingWorkTypes"
        :is-generating="isGenerating"
        :is-submitting="isSubmitting"
        @load-projects="loadProjects"
        @select-project="selectProject"
        @select-work-type="selectWorkType"
        @update:hours="setHours"
        @update:work-content="setWorkContent"
        @update:fill-days="setFillDays"
        @generate="handleGenerate"
        @update-entry="updateEntry"
        @submit="handleSubmit"
        @reset="resetForm"
      />

      <HomeAutoFillForm
        ref="autoFillFormRef"
        :status="autoFillStatus"
        :config="autoFillConfig"
        :deadline-display="deadlineDisplay"
        :projects="projects"
        :work-types="workTypes"
        :is-loading="isAutoFillLoading"
        :is-saving="isAutoFillSaving"
        :is-disabling="isAutoFillDisabling"
        @load-projects="loadProjects"
        @save="handleAutoFillSave"
        @disable="handleAutoFillDisable"
      />

      <HomeNotifyEntry
        :auto-fill-enabled="autoFillEnabled"
      />
    </div>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: #f4efe7;
  padding: 1rem;
}

.home__container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 900px) {
  .home__container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .home__container > :first-child {
    grid-column: 1 / -1;
  }

  .home__container > :last-child {
    grid-column: 1 / -1;
  }
}
</style>
