<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';

import HomeAutoFillPanel from '../components/home/HomeAutoFillPanel.vue';
import HomeManualFillPanel from '../components/home/HomeManualFillPanel.vue';
import HomeNotificationCard from '../components/home/HomeNotificationCard.vue';
import HomeUserPanel from '../components/home/HomeUserPanel.vue';
import HomeWeekBoardPanel from '../components/home/HomeWeekBoardPanel.vue';
import { useAuthSession } from '../composables/useAuthSession';
import { useAutoFillManager } from '../composables/useAutoFillManager';
import { useQuickFillLauncher } from '../composables/useQuickFillLauncher';
import { useTimesheetCatalog } from '../composables/useTimesheetCatalog';
import { useWeekBoardData } from '../composables/useWeekBoardData';

const auth = useAuthSession();
const weekBoard = useWeekBoardData();
const catalog = useTimesheetCatalog();
const autoFill = useAutoFillManager();
const {
  recommendedDaysToGenerate,
  preferredReportDate,
  preferredStep,
  openManualFill: prepareManualFill,
} = useQuickFillLauncher();

const { userId, userInfo, isLoading, restoreAuth, handleTokenExpired, logout } = auth;
const {
  board,
  fillableDays,
  totalHours,
  workDays,
  averageHours,
  weekTitle,
  weekRange,
  errorMessage,
  errorCode,
  isLoading: isWeekLoading,
  isCurrentWeek,
  loadWeek,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
} = weekBoard;
const { projects, isProjectsLoading, loadProjects: loadCatalogProjects, loadWorkTypes } = catalog;
const {
  config,
  status,
  isSaving,
  isDisabling,
  isTriggering,
  load: loadAutoFill,
  save: saveAutoFillConfig,
  disable: disableAutoFillConfig,
  trigger: triggerAutoFillConfig,
} = autoFill;

const notifyVisible = computed(() => status.value === 'enabled');
const isManualFillVisible = shallowRef(false);

watch(
  fillableDays,
  (days) => {
    if (days.length === 0) {
      isManualFillVisible.value = false;
    }
  },
  { immediate: true },
);

async function refreshWeekBoard(): Promise<void> {
  const ok = await loadWeek();
  if (!ok && errorCode.value === 'TOKEN_EXPIRED') {
    handleTokenExpired();
  }
}

async function switchWeek(direction: 'previous' | 'current' | 'next'): Promise<void> {
  const actions = {
    previous: goToPreviousWeek,
    current: goToCurrentWeek,
    next: goToNextWeek,
  } as const;
  const ok = await actions[direction]();

  if (!ok && errorCode.value === 'TOKEN_EXPIRED') {
    handleTokenExpired();
  }
}

async function initialize(): Promise<void> {
  const ok = await restoreAuth();
  if (!ok || !userId.value) {
    return;
  }

  await Promise.all([refreshWeekBoard(), loadAutoFill(userId.value)]);
}

async function loadProjects(): Promise<void> {
  if (!userId.value) {
    return;
  }

  await loadCatalogProjects(userId.value);
}

function openManualFill(): void {
  if (!prepareManualFill(fillableDays.value)) {
    return;
  }

  isManualFillVisible.value = true;
  void loadProjects();
}

function closeManualFill(): void {
  isManualFillVisible.value = false;
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <main class="home-shell">
    <div class="home-shell__container">
      <HomeUserPanel :user-info="userInfo" :is-loading="isLoading" @logout="logout" />

      <HomeWeekBoardPanel
        :board="board"
        :is-loading="isWeekLoading"
        :error-message="errorMessage"
        :week-title="weekTitle"
        :week-range="weekRange"
        :total-hours="totalHours"
        :work-days="workDays"
        :average-hours="averageHours"
        :fillable-count="fillableDays.length"
        :is-current-week="isCurrentWeek"
        @previous-week="switchWeek('previous')"
        @current-week="switchWeek('current')"
        @next-week="switchWeek('next')"
        @open-manual-fill="openManualFill"
      />

      <HomeManualFillPanel
        :visible="isManualFillVisible"
        :fillable-days="fillableDays"
        :projects="projects"
        :is-projects-loading="isProjectsLoading"
        :recommended-days-to-generate="recommendedDaysToGenerate"
        :preferred-report-date="preferredReportDate"
        :preferred-step="preferredStep"
        :load-projects="loadProjects"
        :load-work-types="loadWorkTypes"
        @close="closeManualFill"
        @submitted="refreshWeekBoard"
      />

      <HomeAutoFillPanel
        :user-id="userId"
        :config="config"
        :status="status"
        :projects="projects"
        :is-projects-loading="isProjectsLoading"
        :is-saving="isSaving"
        :is-disabling="isDisabling"
        :is-triggering="isTriggering"
        :load-projects="loadProjects"
        :load-work-types="loadWorkTypes"
        :save-config="saveAutoFillConfig"
        :disable-config="disableAutoFillConfig"
        :trigger-config="triggerAutoFillConfig"
        @updated="initialize"
      />

      <HomeNotificationCard :visible="notifyVisible" />
    </div>
  </main>
</template>

<style scoped>
.home-shell {
  min-height: 100vh;
  padding: 1rem;
}

.home-shell__container {
  width: min(100%, 1080px);
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}
</style>
