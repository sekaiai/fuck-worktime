<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';

import HomeAutoFillPanel from '../components/home/HomeAutoFillPanel.vue';
import HomeManualFillPanel from '../components/home/HomeManualFillPanel.vue';
import HomeNotificationCard from '../components/home/HomeNotificationCard.vue';
import HomeUserPanel from '../components/home/HomeUserPanel.vue';
import HomeWeekBoardPanel from '../components/home/HomeWeekBoardPanel.vue';
import { useHomeStore } from '../stores/home';

const homeStore = useHomeStore();
const { board, fillableDays, totalHours, weekRange, errorMessage, isCurrentWeek, autoFillStatus } =
  storeToRefs(homeStore);

const headline = computed(() => (isCurrentWeek.value ? '本周工时控制台' : '历史周工时归档'));
const statusLabel = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return '自动填报运行中';
  }
  if (autoFillStatus.value === 'expired') {
    return '自动填报已过期';
  }
  return fillableDays.value.length > 0 ? '待人工补填' : '本周记录完整';
});
const headlineCopy = computed(() => {
  if (errorMessage.value) {
    return errorMessage.value;
  }
  if (fillableDays.value.length > 0) {
    return `当前仍有 ${fillableDays.value.length} 个工作日未填报，可立即进入手动补填流程。`;
  }
  return '本周记录已齐，可继续检查明细、维护自动填报策略和通知链路。';
});
const heroStats = computed(() => [
  {
    label: '周区间',
    value: weekRange.value || board.value?.weekRange || '等待数据',
  },
  {
    label: '待补填',
    value: `${fillableDays.value.length} 天`,
  },
  {
    label: '总工时',
    value: `${totalHours.value} h`,
  },
  {
    label: '自动填报',
    value: statusLabel.value,
  },
]);

onMounted(() => {
  void homeStore.initialize();
});
</script>

<template>
  <main class="home-shell">
    <section class="home-shell__hero">
      <div class="home-shell__hero-copy">
        <p class="home-shell__eyebrow">Timesheet Control Room</p>
        <h1 class="home-shell__title">{{ headline }}</h1>
        <p class="home-shell__subtitle">{{ headlineCopy }}</p>
      </div>

      <div class="home-shell__hero-stats">
        <article v-for="item in heroStats" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>
    </section>

    <section class="home-shell__layout">
      <div class="home-shell__primary">
        <HomeUserPanel />

        <HomeWeekBoardPanel />

        <HomeManualFillPanel />
      </div>

      <aside class="home-shell__secondary">
        <HomeAutoFillPanel />

        <HomeNotificationCard />
      </aside>
    </section>
  </main>
</template>

<style scoped>
.home-shell {
  width: min(100%, 1240px);
  margin: 0 auto;
  min-height: 100vh;
  padding: clamp(1rem, 3vw, 2rem);
  display: grid;
  gap: 1rem;
}

.home-shell__hero,
.home-shell__layout {
  display: grid;
  gap: 1rem;
}

.home-shell__hero {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  border: 1px solid var(--line-soft);
  border-radius: 34px;
  padding: clamp(1.2rem, 2.8vw, 2rem);
  background:
    linear-gradient(135deg, rgba(22, 57, 60, 0.92), rgba(31, 42, 44, 0.82)),
    radial-gradient(circle at right top, rgba(208, 147, 62, 0.24), transparent 36%);
  color: rgba(255, 248, 238, 0.94);
  box-shadow: 0 30px 70px rgba(20, 41, 44, 0.14);
}

.home-shell__hero-copy {
  display: grid;
  align-content: start;
}

.home-shell__eyebrow {
  margin: 0 0 0.6rem;
  color: rgba(225, 175, 103, 0.88);
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.home-shell__title {
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.94;
}

.home-shell__subtitle {
  max-width: 38rem;
  margin-top: 1rem;
  color: rgba(255, 245, 232, 0.72);
  font-size: 1.04rem;
  line-height: 1.75;
}

.home-shell__hero-stats {
  display: grid;
  gap: 0.8rem;
}

.home-shell__hero-stats article {
  display: grid;
  gap: 0.25rem;
  align-content: end;
  border-radius: 20px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.home-shell__hero-stats span {
  color: rgba(255, 245, 232, 0.54);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.home-shell__hero-stats strong {
  font-family: var(--font-display);
  font-size: 1.06rem;
}

.home-shell__layout {
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
  align-items: start;
}

.home-shell__primary,
.home-shell__secondary {
  display: grid;
  gap: 1rem;
}

@media (max-width: 980px) {
  .home-shell__hero,
  .home-shell__layout {
    grid-template-columns: 1fr;
  }
}
</style>
