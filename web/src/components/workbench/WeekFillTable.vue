<script setup lang="ts">
import { storeToRefs } from 'pinia';

import WeekFillDay from './WeekFillDay.vue';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const { dayForms, isWeekLoading } = storeToRefs(homeStore);
</script>

<template>
  <section class="wf-table">
    <p v-if="isWeekLoading" class="wf-table__loading">加载中…</p>
    <template v-else>
      <WeekFillDay
        v-for="item in dayForms"
        :key="item.day.date"
        :day="item.day"
        :status="item.status"
        :form="item.form"
      />
    </template>
  </section>
</template>

<style scoped>
.wf-table {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  overflow: hidden;
}

.wf-table__loading {
  margin: 0;
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}
</style>
