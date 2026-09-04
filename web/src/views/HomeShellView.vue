<script setup lang="ts">
import { onMounted } from 'vue';

import WeekFillHeader from '../components/workbench/WeekFillHeader.vue';
import WeekFillSubmitBar from '../components/workbench/WeekFillSubmitBar.vue';
import WeekFillTable from '../components/workbench/WeekFillTable.vue';
import WeekFillToolbar from '../components/workbench/WeekFillToolbar.vue';
import { useHomeStore } from '../stores/home';

const homeStore = useHomeStore();

onMounted(() => {
  void homeStore.initialize();
});
</script>

<template>
  <main class="home-shell">
    <WeekFillHeader />
    <WeekFillToolbar />
    <WeekFillTable />
    <WeekFillSubmitBar />
  </main>
</template>

<style scoped>
.home-shell {
  width: min(100%, 1080px);
  margin: 0 auto;
  min-height: 100vh;
  padding: clamp(0.9rem, 1.6vw, 1.6rem);
  display: grid;
  gap: 0.9rem;
  align-content: start;
}
</style>
