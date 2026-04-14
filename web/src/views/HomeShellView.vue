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
const quickFill = useQuickFillLauncher();

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
  canGoNextWeek,
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
  load: loadAutoFill,
  save: saveAutoFillConfig,
  disable: disableAutoFillConfig,
} = autoFill;

const notifyVisible = computed(() => status.value === 'enabled');
const isManualFillVisible = shallowRef(false);
const { recommendedDaysToGenerate, preferredReportDate, preferredStep } = quickFill;
const mobileTaskSummary = computed(() =>
  fillableDays.value.length > 0
    ? `今天可处理 ${fillableDays.value.length} 天待填工时`
    : '本周暂无待补填工时',
);

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
  let ok = false;

  if (direction === 'previous') {
    ok = await goToPreviousWeek();
  } else if (direction === 'current') {
    ok = await goToCurrentWeek();
  } else {
    ok = await goToNextWeek();
  }

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
  if (!quickFill.openManualFill(fillableDays.value)) {
    return;
  }
  isManualFillVisible.value = true;
  void loadProjects();
}

function quickFillOneDay(): void {
  if (!quickFill.quickFillOneDay(fillableDays.value)) {
    return;
  }
  isManualFillVisible.value = true;
  void loadProjects();
}

function closeManualFill(): void {
  isManualFillVisible.value = false;
}

async function saveAutoFill(payload: Parameters<typeof saveAutoFillConfig>[0]) {
  return saveAutoFillConfig(payload);
}

async function disableAutoFill(userIdValue: string) {
  return disableAutoFillConfig(userIdValue);
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <main class="home-shell">
    <div class="home-shell__container">
      <HomeUserPanel :user-info="userInfo" :is-loading="isLoading" @logout="logout" />

      <section class="task-hub">
        <p class="task-hub__eyebrow">今日任务</p>
        <h2 class="task-hub__title">{{ mobileTaskSummary }}</h2>
        <div class="task-hub__actions">
          <button
            class="task-hub__primary"
            type="button"
            :disabled="fillableDays.length === 0"
            @click="openManualFill"
          >
            {{ fillableDays.length > 0 ? '立即补填工时' : '暂无可补填工时' }}
          </button>
          <button class="task-hub__ghost" type="button" @click="loadProjects">准备自动填报配置</button>
          <button
            v-if="fillableDays.length > 1"
            class="task-hub__ghost"
            type="button"
            @click="quickFillOneDay"
          >
            快速补填 1 天
          </button>
        </div>
      </section>

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
        :can-go-next-week="canGoNextWeek"
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
        :load-projects="loadProjects"
        :load-work-types="loadWorkTypes"
        :save-config="saveAutoFill"
        :disable-config="disableAutoFill"
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

.task-hub {
  border-radius: 24px;
  background: linear-gradient(180deg, #fff9ef, #f7f3ea);
  padding: 1rem;
  box-shadow: 0 12px 24px rgba(15, 61, 62, 0.08);
}

.task-hub__eyebrow {
  margin: 0;
  color: #7c6c54;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.task-hub__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
  color: #13272c;
}

.task-hub__actions {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.55rem;
}

.task-hub__primary,
.task-hub__ghost {
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1rem;
}

.task-hub__primary {
  background: #0f4f53;
  color: #fff;
}

.task-hub__ghost {
  background: #ece8df;
  color: #24383f;
}

@media (min-width: 960px) {
  .home-shell__container {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-shell__container > :first-child,
  .home-shell__container > :last-child,
  .home-shell__container > :nth-child(2),
  .home-shell__container > :nth-child(3) {
    grid-column: 1 / -1;
  }
}
</style>
