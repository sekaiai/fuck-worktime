<script setup lang="ts">
import { onMounted } from 'vue';

import AutoFillSettingsDialog from '../components/workbench/AutoFillSettingsDialog.vue';
import WeekFillHeader from '../components/workbench/WeekFillHeader.vue';
import WeekFillSubmitBar from '../components/workbench/WeekFillSubmitBar.vue';
import WeekFillTable from '../components/workbench/WeekFillTable.vue';
import WeekFillToolbar from '../components/workbench/WeekFillToolbar.vue';
import WorkbenchSidebar from '../components/workbench/WorkbenchSidebar.vue';
import { useIsMobile } from '../composables/useIsMobile';
import { useHomeStore } from '../stores/home';

const homeStore = useHomeStore();
const isMobile = useIsMobile();

onMounted(() => {
  void homeStore.initialize();
});
</script>

<template>
  <div class="home-shell">
    <WeekFillHeader />

    <div class="home-shell__scroll">
      <div class="home-shell__grid">
        <WorkbenchSidebar v-if="!isMobile" />
        <main class="home-shell__main">
          <WeekFillToolbar />
          <WeekFillTable />
          <WeekFillSubmitBar />
        </main>
      </div>
    </div>

    <!-- 弹窗由顶栏与左栏共用同一份实例，挂在布局层统一渲染 -->
    <AutoFillSettingsDialog
      :open="homeStore.isAutoFillDialogOpen"
      @close="homeStore.closeAutoFillDialog()"
    />
  </div>
</template>

<style scoped>
.home-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.home-shell__scroll {
  flex: 1;
  min-height: 0;
}

.home-shell__grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  align-items: start;
  gap: 1.5rem;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem;
}

.home-shell__main {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-width: 0;
}

/* 中窄屏：左栏退到填报区下方，整列排布 */
@media (max-width: 1199px) {
  .home-shell__grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.4rem;
    gap: 0.5rem;
  }

  /* 填报是主流程，移动端排在前；日历/统计/自动填报随其后 */
  .home-shell__grid > :first-child {
    order: 2;
  }

  .home-shell__main {
    order: 1;
    gap:0.5rem;
  }
}
</style>
