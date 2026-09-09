<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { totalHours, workDays, averageHours, weekRange, dayForms } = storeToRefs(homeStore);

const summary = computed(() => {
  const pending = dayForms.value.filter((item) => item.status.key === 'none').length;
  const rejected = dayForms.value.filter((item) => item.status.key === 'rejected').length;
  const approvalPending = dayForms.value.filter((item) => item.status.key === 'pending').length;
  const approved = dayForms.value.filter((item) => item.status.key === 'approved').length;
  return { pending, rejected, approvalPending, approved };
});

const summaryText = computed(() => {
  const parts = [
    `已录入 ${totalHours.value}h`,
    `工作日 ${workDays.value} 天`,
    `日均 ${averageHours.value}h`,
  ];

  if (summary.value.pending > 0) {
    parts.push(`待填 ${summary.value.pending} 天`);
  }
  if (summary.value.approvalPending > 0) {
    parts.push(`待审批 ${summary.value.approvalPending} 天`);
  }
  if (summary.value.rejected > 0) {
    parts.push(`${summary.value.rejected} 天审核失败`);
  }
  if (summary.value.approved > 0) {
    parts.push(`已审核 ${summary.value.approved} 天`);
  }

  return parts.join(' · ');
});
</script>

<template>
  <section class="wfa-card">
    <div class="wfa-card__head">
      <p class="wfa-card__title">周统计</p>
      <span class="wfa-card__chip">{{ weekRange || '加载中…' }}</span>
    </div>

    <div class="wfa-metrics">
      <div class="wfa-metric">
        <p class="wfa-metric__value">{{ totalHours }}h</p>
        <p class="wfa-metric__label">已录入</p>
      </div>
      <div class="wfa-metric">
        <p class="wfa-metric__value">{{ workDays }} 天</p>
        <p class="wfa-metric__label">工作日</p>
      </div>
      <div class="wfa-metric">
        <p class="wfa-metric__value">{{ averageHours }}h</p>
        <p class="wfa-metric__label">日均</p>
      </div>
    </div>

    <ul class="wfa-counts">
      <li class="wfa-count" v-show="summary.pending">
        <span class="wfa-dot wfa-dot--none" aria-hidden="true"></span>
        <span class="wfa-count__label">待填</span>
        <strong class="wfa-count__value">{{ summary.pending }} 天</strong>
      </li>
      <li class="wfa-count" v-show="summary.approvalPending">
        <span class="wfa-dot wfa-dot--pending" aria-hidden="true"></span>
        <span class="wfa-count__label">待审批</span>
        <strong class="wfa-count__value">{{ summary.approvalPending }} 天</strong>
      </li>
      <li class="wfa-count" v-show="summary.rejected">
        <span class="wfa-dot wfa-dot--rejected" aria-hidden="true"></span>
        <span class="wfa-count__label">审核失败</span>
        <strong class="wfa-count__value">{{ summary.rejected }} 天</strong>
      </li>
      <li class="wfa-count" v-show="summary.approved">
        <span class="wfa-dot wfa-dot--approved" aria-hidden="true"></span>
        <span class="wfa-count__label">已审核</span>
        <strong class="wfa-count__value">{{ summary.approved }} 天</strong>
      </li>
    </ul>

    <p class="wfa-summary">{{ summaryText }}</p>
  </section>
</template>

<style scoped>
.wfa-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.wfa-metric {
  padding: 0.6rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-panel);
  text-align: center;
}

.wfa-metric__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

.wfa-metric__label {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}

.wfa-counts {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wfa-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
}

.wfa-count__label {
  color: var(--color-text-secondary);
}

.wfa-count__value {
  margin-left: auto;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wfa-summary {
  margin: 0;
  padding-top: 0.7rem;
  border-top: 1px dashed var(--color-border);
  font-size: 0.76rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.wfa-dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
}

.wfa-dot--none {
  background: var(--color-text-tertiary);
}

.wfa-dot--pending {
  background: var(--color-primary);
}

.wfa-dot--rejected {
  background: var(--color-danger);
}

.wfa-dot--approved {
  background: var(--color-success);
}
</style>
