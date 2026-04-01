<script setup lang="ts">
import { useRouter } from 'vue-router';
import HomeOverviewCards from '../components/home/HomeOverviewCards.vue';
import HomeWeekTimeline from '../components/home/HomeWeekTimeline.vue';
import { useWeeklyReportMock } from '../composables/useWeeklyReportMock';

const router = useRouter();

const {
  activeWeek,
  report,
  selectedDate,
  selectedDay,
  selectWeek,
  selectDay,
} = useWeeklyReportMock();

const goToNotifications = () => {
  router.push('/notifications');
};
</script>

<template>
  <main class="home-shell">
    <HomeOverviewCards
      :report="report"
      :active-week="activeWeek"
      @switch-week="selectWeek"
    />

    <HomeWeekTimeline
      :days="report.days"
      :selected-date="selectedDate"
      @select-day="selectDay"
    />

    <section class="detail-panel" aria-label="工时明细">
      <header class="detail-head">
        <h2 class="detail-title">工时明细</h2>
        <p class="detail-tip">点击上方某一天后显示详情</p>
      </header>

      <div v-if="!selectedDay" class="detail-empty">
        请选择一个日期查看明细。
      </div>

      <div v-else-if="selectedDay.details.length === 0" class="detail-empty">
        {{ selectedDay.dayOfWeek }}（{{ selectedDay.date }}）暂无填报明细。
      </div>

      <div v-else class="detail-content">
        <p class="detail-date">{{ selectedDay.dayOfWeek }} · {{ selectedDay.date }}</p>
        <p class="detail-status">{{ selectedDay.displayStatus }}</p>

        <ul class="detail-list">
          <li v-for="item in selectedDay.details" :key="item.id" class="detail-item">
            <p class="item-meta">{{ item.period }} · {{ item.hours }}h · {{ item.statusDesc }}</p>
            <p class="item-text">{{ item.content }}</p>
          </li>
        </ul>
      </div>
    </section>

    <button class="notify-button" @click="goToNotifications">前往消息提醒</button>
  </main>
</template>

<style scoped>
.home-shell {
  width: min(1040px, 100%);
  margin: 0 auto;
  padding: 0.85rem 0.75rem 1.4rem;
}

.detail-panel {
  margin-top: 0.9rem;
  border: 1px solid #d2e0da;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 0.9rem;
}

.detail-head {
  display: grid;
  gap: 0.25rem;
}

.detail-title {
  margin: 0;
  color: #163932;
  font-size: 1rem;
}

.detail-tip {
  margin: 0;
  color: #607a72;
  font-size: 0.82rem;
}

.detail-empty {
  margin-top: 0.75rem;
  color: #5f7771;
  font-size: 0.9rem;
  background: #f7fbf9;
  border: 1px dashed #c8d9d2;
  border-radius: 0.7rem;
  padding: 0.75rem;
}

.detail-content {
  margin-top: 0.75rem;
}

.detail-date {
  margin: 0;
  color: #21443d;
  font-size: 0.9rem;
  font-weight: 700;
}

.detail-status {
  margin: 0.35rem 0 0;
  color: #55716a;
  font-size: 0.86rem;
}

.detail-list {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.detail-item {
  border: 1px solid #d8e5df;
  border-radius: 0.7rem;
  background: #f9fdfb;
  padding: 0.65rem;
}

.item-meta {
  margin: 0;
  color: #2f544c;
  font-size: 0.82rem;
  font-weight: 700;
}

.item-text {
  margin: 0.35rem 0 0;
  color: #2b4a43;
  font-size: 0.88rem;
  line-height: 1.5;
}

.notify-button {
  width: 100%;
  margin-top: 0.9rem;
  border: none;
  border-radius: 0.75rem;
  background: #145848;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 0.75rem;
}

@media (min-width: 900px) {
  .home-shell {
    padding: 1.2rem 1rem 2rem;
  }

  .detail-panel {
    padding: 1.1rem;
  }

  .notify-button {
    width: auto;
    min-width: 180px;
    padding: 0.75rem 1.15rem;
  }
}
</style>
