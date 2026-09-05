<script setup lang="ts">
import WorkbenchAutoFillCard from './WorkbenchAutoFillCard.vue';
import WorkbenchCalendar from './WorkbenchCalendar.vue';
import WorkbenchStats from './WorkbenchStats.vue';
</script>

<template>
  <aside class="wfa-side">
    <WorkbenchCalendar />
    <WorkbenchStats />
    <WorkbenchAutoFillCard />
  </aside>
</template>

<style scoped>
/* 左栏按内容自然撑开、随页面滚动；不加视口高度上限，避免日历等内容被截断 */
.wfa-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
