<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const {
  autoFillStatus,
  projects,
  isProjectsLoading,
  isSaving,
  isDisabling,
  isTriggering,
  autoIsOpen,
  autoProjectId,
  autoWorkTypeGroupId,
  autoItemId,
  autoHours,
  autoWork,
  autoReportTime,
  autoDeadline,
  autoToastMessage,
  autoResultDialog,
  autoWorkTypeGroups,
  autoAvailableWorkTypes,
  autoOverviewItems,
} = storeToRefs(homeStore);

const statusText = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return '已启用';
  }
  if (autoFillStatus.value === 'expired') {
    return '已过期';
  }
  return '已禁用';
});
</script>

<template>
  <section class="auto-fill-panel" :class="{ 'is-open': autoIsOpen }">
    <header class="auto-fill-panel__header">
      <div>
        <p class="auto-fill-panel__eyebrow">Auto Fill</p>
        <h2 class="auto-fill-panel__title">自动填报策略</h2>
      </div>
      <span class="auto-fill-panel__badge" :class="`is-${autoFillStatus}`">{{ statusText }}</span>
    </header>

    <p class="auto-fill-panel__copy">
      维护一个固定策略后，系统会在设定时间自动为可填报工作日生成内容并提交。
    </p>

    <div v-if="autoOverviewItems.length > 0" class="auto-fill-panel__overview">
      <article v-for="item in autoOverviewItems" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
    <div v-else class="auto-fill-panel__empty">当前还没有自动填报配置，展开后即可开始设置。</div>

    <button class="auto-fill-panel__toggle" type="button" @click="homeStore.toggleAutoFillOpen()">
      {{ autoIsOpen ? '收起配置面板' : '展开配置面板' }}
    </button>

    <Transition name="auto-fill-expand">
      <div v-if="autoIsOpen" class="auto-fill-panel__editor">
        <div class="auto-fill-panel__form">
          <label>
            <span>项目</span>
            <select :value="autoProjectId" @change="homeStore.setAutoProject(($event.target as HTMLSelectElement).value)">
              <option value="">请选择项目</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
            </select>
          </label>

          <label>
            <span>一级工时类型</span>
            <select
              :value="autoWorkTypeGroupId"
              :disabled="autoWorkTypeGroups.length === 0"
              @change="homeStore.setAutoWorkTypeGroup(($event.target as HTMLSelectElement).value)"
            >
              <option value="">请选择一级类型</option>
              <option v-for="group in autoWorkTypeGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
            </select>
          </label>

          <label>
            <span>二级工时类型</span>
            <select
              :value="autoItemId"
              :disabled="autoAvailableWorkTypes.length === 0"
              @change="homeStore.setAutoItem(($event.target as HTMLSelectElement).value)"
            >
              <option value="">请选择二级类型</option>
              <option v-for="item in autoAvailableWorkTypes" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>

          <label>
            <span>工时</span>
            <input
              :value="autoHours"
              type="number"
              min="1"
              max="24"
              @input="homeStore.setAutoHours(Number(($event.target as HTMLInputElement).value))"
            />
          </label>

          <label>
            <span>填报时间</span>
            <input
              :value="autoReportTime"
              type="time"
              @input="homeStore.setAutoReportTime(($event.target as HTMLInputElement).value)"
            />
          </label>

          <label>
            <span>截止日期</span>
            <input
              :value="autoDeadline"
              type="date"
              @input="homeStore.setAutoDeadline(($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="auto-fill-panel__full">
            <span>工作内容模板</span>
            <textarea
              :value="autoWork"
              rows="4"
              placeholder="输入自动填报使用的工作内容模板"
              @input="homeStore.setAutoWork(($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </div>

        <p class="auto-fill-panel__hint">
          若未设置截止日期，调度器会在每个有效工作日的指定时间自动尝试填报当天工时。
        </p>

        <div class="auto-fill-panel__actions">
          <button
            class="auto-fill-panel__primary"
            type="button"
            :disabled="isSaving || isProjectsLoading"
            @click="homeStore.saveCurrentAutoFillConfig()"
          >
            {{ isSaving ? '保存中...' : '保存自动填报配置' }}
          </button>
          <button
            v-if="autoFillStatus === 'enabled'"
            class="auto-fill-panel__secondary"
            type="button"
            :disabled="isTriggering"
            @click="homeStore.runAutoFillConfigNow()"
          >
            {{ isTriggering ? '执行中...' : '立即执行' }}
          </button>
          <button
            v-if="autoFillStatus === 'enabled'"
            class="auto-fill-panel__secondary"
            type="button"
            :disabled="isDisabling"
            @click="homeStore.disableCurrentAutoFillConfig()"
          >
            {{ isDisabling ? '禁用中...' : '禁用策略' }}
          </button>
        </div>
      </div>
    </Transition>

    <InlineToast :message="autoToastMessage" />
    <ResultDialog
      :open="autoResultDialog.open"
      :title="autoResultDialog.title"
      :message="autoResultDialog.message"
      @close="homeStore.closeAutoResultDialog()"
    />
  </section>
</template>

<style scoped>
.auto-fill-panel {
  position: relative;
  display: grid;
  gap: 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 28px;
  padding: 1.25rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.84), rgba(240, 233, 224, 0.72));
  box-shadow: 0 22px 44px rgba(20, 41, 44, 0.09);
}

.auto-fill-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.auto-fill-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.auto-fill-panel__title {
  font-size: 1.55rem;
}

.auto-fill-panel__copy,
.auto-fill-panel__hint {
  color: var(--ink-soft);
  line-height: 1.7;
}

.auto-fill-panel__badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.auto-fill-panel__badge.is-enabled {
  background: rgba(35, 76, 75, 0.14);
  color: var(--accent);
}

.auto-fill-panel__badge.is-expired {
  background: rgba(170, 71, 55, 0.1);
  color: var(--danger);
}

.auto-fill-panel__overview {
  display: grid;
  gap: 0.7rem;
}

.auto-fill-panel__overview article {
  display: grid;
  gap: 0.25rem;
  border-radius: 18px;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(19, 38, 40, 0.08);
}

.auto-fill-panel__overview span {
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auto-fill-panel__overview strong {
  font-family: var(--font-display);
  font-size: 1rem;
}

.auto-fill-panel__empty {
  border-radius: 18px;
  padding: 0.95rem;
  background: rgba(255, 255, 255, 0.46);
  color: var(--ink-soft);
}

.auto-fill-panel__toggle,
.auto-fill-panel__primary,
.auto-fill-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.auto-fill-panel__toggle,
.auto-fill-panel__secondary {
  background: rgba(19, 38, 40, 0.08);
  color: var(--ink-strong);
}

.auto-fill-panel__primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}

.auto-fill-panel__editor {
  display: grid;
  gap: 1rem;
}

.auto-fill-panel__form {
  display: grid;
  gap: 0.8rem;
}

.auto-fill-panel__form label {
  display: grid;
  gap: 0.35rem;
  color: var(--ink-strong);
}

.auto-fill-panel__full {
  grid-column: 1 / -1;
}

.auto-fill-panel__form span {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.auto-fill-panel__form select,
.auto-fill-panel__form input,
.auto-fill-panel__form textarea {
  width: 100%;
  border: 1px solid rgba(19, 38, 40, 0.14);
  border-radius: 18px;
  padding: 0.86rem 0.95rem;
  background: rgba(255, 255, 255, 0.72);
}

.auto-fill-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.auto-fill-expand-enter-active,
.auto-fill-expand-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.auto-fill-expand-enter-from,
.auto-fill-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 640px) {
  .auto-fill-panel__header {
    flex-direction: column;
  }
}
</style>
