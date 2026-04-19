<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';

import HomeAutoFillPanel from '../components/home/HomeAutoFillPanel.vue';
import HomeManualFillPanel from '../components/home/HomeManualFillPanel.vue';
import HomeWeekBoardPanel from '../components/home/HomeWeekBoardPanel.vue';
import { useAuthStore } from '../stores/auth';
import { useHomeStore } from '../stores/home';

const homeStore = useHomeStore();
const authStore = useAuthStore();
const { fillableDays, errorMessage, autoFillStatus, isManualFillVisible } = storeToRefs(homeStore);
const { userInfo } = storeToRefs(authStore);

const headline = computed(() => userInfo.value?.nickname || 'Authenticated User');
const heroMeta = computed(() => userInfo.value?.phone || '未提供手机号');
const headlineCopy = computed(() => {
  if (errorMessage.value) {
    return errorMessage.value;
  }
  if (fillableDays.value.length > 0) {
    return `当前仍有 ${fillableDays.value.length} 个工作日待补填，可直接进入补填流程处理。`;
  }
  return '本周记录已齐，可以继续核对明细、维护自动填报策略与通知状态。';
});
const heroStatus = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return 'Auto Fill Running';
  }
  if (autoFillStatus.value === 'expired') {
    return 'Auto Fill Expired';
  }
  return 'Auto Fill Idle';
});

onMounted(() => {
  void homeStore.initialize();
});
</script>

<template>
  <main class="home-shell">
    <section class="home-shell__hero">
      <div class="home-shell__hero-copy">
        <p class="home-shell__eyebrow">Authenticated User</p>
        <h1 class="home-shell__title">{{ headline }}</h1>
        <p class="home-shell__meta">{{ heroMeta }}</p>
        <p class="home-shell__subtitle">{{ headlineCopy }}</p>
      </div>

      <div class="home-shell__hero-panel">
        <div class="home-shell__hero-line">
          <span>Session</span>
          <strong>{{ heroStatus }}</strong>
        </div>
        <div class="home-shell__hero-line">
          <span>Pending</span>
          <strong>{{ fillableDays.length }} day<span v-if="fillableDays.length !== 1">s</span></strong>
        </div>
      </div>
    </section>

    <section class="home-shell__layout" :class="{ 'has-manual': isManualFillVisible }">
      <div class="home-shell__board">
        <HomeWeekBoardPanel />
      </div>

      <div class="home-shell__auto">
        <HomeAutoFillPanel />
      </div>

      <div v-if="isManualFillVisible" class="home-shell__manual">
        <HomeManualFillPanel />
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-shell {
  width: min(100%, 1320px);
  margin: 0 auto;
  min-height: 100vh;
  padding: clamp(1rem, 2vw, 2.2rem);
  display: grid;
  gap: 1.25rem;
}

.home-shell__hero,
.home-shell__layout {
  display: grid;
  gap: 1rem;
}

.home-shell__hero {
  grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.72fr);
  align-items: stretch;
  border: 1px solid var(--line-soft);
  border-radius: 34px;
  padding: clamp(1.2rem, 2.4vw, 2.2rem);
  background:
    linear-gradient(135deg, rgba(20, 49, 52, 0.94), rgba(28, 39, 42, 0.88)),
    radial-gradient(circle at right top, rgba(208, 147, 62, 0.24), transparent 34%);
  color: rgba(255, 248, 238, 0.94);
  box-shadow: 0 30px 70px rgba(20, 41, 44, 0.14);
  overflow: hidden;
}

.home-shell__hero-copy {
  display: grid;
  align-content: start;
  padding-right: clamp(0rem, 2vw, 1.4rem);
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

.home-shell__meta {
  margin-top: 0.55rem;
  color: rgba(255, 245, 232, 0.82);
  font-family: var(--font-display);
  font-size: 0.98rem;
  letter-spacing: 0.08em;
}

.home-shell__subtitle {
  max-width: 38rem;
  margin-top: 1rem;
  color: rgba(255, 245, 232, 0.72);
  font-size: 1.04rem;
  line-height: 1.75;
}

.home-shell__hero-panel {
  align-self: stretch;
  display: grid;
  align-content: end;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(225, 175, 103, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.home-shell__hero-line {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.home-shell__hero-line:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.home-shell__hero-line span {
  color: rgba(255, 245, 232, 0.62);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.home-shell__hero-line strong {
  text-align: right;
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.06em;
}

.home-shell__layout {
  grid-template-columns: 1fr 485px;
  align-items: start;
}

.home-shell__auto,
.home-shell__board,
.home-shell__manual {
  min-width: 0;
}

.home-shell__manual {
  grid-column: 1 / -1;
}

@media (max-width: 1180px) {
  .home-shell__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .home-shell__hero {
    grid-template-columns: 1fr;
  }

  .home-shell__hero-copy {
    padding-right: 0;
  }
}
</style>
