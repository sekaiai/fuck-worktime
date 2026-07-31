<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';

import HomeAutoFillPanel from '../components/home/HomeAutoFillPanel.vue';
import HomeManualFillPanel from '../components/home/HomeManualFillPanel.vue';
import HomeWeekBoardPanel from '../components/home/HomeWeekBoardPanel.vue';
import WorkbenchCalendar from '../components/workbench/WorkbenchCalendar.vue';
import WorkbenchPendingSummary from '../components/workbench/WorkbenchPendingSummary.vue';
import WorkbenchWeekOverview from '../components/workbench/WorkbenchWeekOverview.vue';
import { useAuthStore } from '../stores/auth';
import { useHomeStore } from '../stores/home';

const homeStore = useHomeStore();
const authStore = useAuthStore();
const { fillableDays, errorMessage, autoFillStatus, isManualFillVisible } = storeToRefs(homeStore);
const { userInfo } = storeToRefs(authStore);

const heroMeta = computed(() => userInfo.value?.phone || '未提供手机号');

const heroStatusBadge = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return { text: '自动填报运行中', class: 'status--running' };
  }
  if (autoFillStatus.value === 'expired') {
    return { text: '自动填报已失效', class: 'status--expired' };
  }
  return { text: '自动填报未启用', class: 'status--idle' };
});

onMounted(() => {
  void homeStore.initialize();
});
</script>

<template>
  <main class="home-shell">
    <header class="home-shell__topbar">
      <div class="home-shell__brand">
        <span class="home-shell__brand-mark"></span>
        <div>
          <p class="home-shell__brand-name">云上工时</p>
          <p class="home-shell__brand-sub">{{ heroMeta }}</p>
        </div>
      </div>
      <div class="home-shell__topbar-meta">
        <span class="home-shell__badge" :class="heroStatusBadge.class">
          <span class="home-shell__status-dot"></span>{{ heroStatusBadge.text }}
        </span>
        <span v-if="fillableDays.length > 0" class="home-shell__pending">{{ fillableDays.length }} 天待处理</span>
      </div>
    </header>

    <div class="home-shell__grid">
      <aside class="home-shell__sidebar">
        <WorkbenchCalendar />
        <WorkbenchWeekOverview />
        <WorkbenchPendingSummary />
      </aside>

      <div class="home-shell__main">
        <HomeWeekBoardPanel />
        <HomeAutoFillPanel />
      </div>
    </div>

    <HomeManualFillPanel v-if="isManualFillVisible" />
  </main>
</template>

<style scoped>
.home-shell {
  width: min(100%, 1440px);
  margin: 0 auto;
  min-height: 100vh;
  padding: clamp(0.9rem, 1.6vw, 1.6rem);
  display: grid;
  gap: 1rem;
}

.home-shell__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.2rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0.75rem;
  z-index: 10;
}

.home-shell__brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.home-shell__brand-mark {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-strong));
}

.home-shell__brand-name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.02rem;
}

.home-shell__brand-sub {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: 0.78rem;
}

.home-shell__topbar-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.home-shell__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.38rem 0.75rem;
  border-radius: 999px;
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}

.home-shell__status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
}

.home-shell__badge.status--running .home-shell__status-dot {
  background: var(--color-success);
}

.home-shell__badge.status--expired .home-shell__status-dot {
  background: var(--color-danger);
}

.home-shell__pending {
  color: var(--color-warning);
  font-size: 0.8rem;
}

.home-shell__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: start;
}

.home-shell__main {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.home-shell__sidebar {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

/* 移动端：主区在前，sidebar 在主区下方 */
.home-shell__main {
  order: -1;
}

@media (min-width: 1024px) {
  .home-shell__grid {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .home-shell__sidebar {
    order: -1;
  }

  .home-shell__main {
    order: 0;
  }
}
</style>
