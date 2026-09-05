<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';

import ConfirmDialog from '../common/ConfirmDialog.vue';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const {
  autoFillConfig,
  autoFillStatus,
  autoFillExecutionText,
  autoOverviewItems,
  isAutoFillTriggering,
  isAutoFillDisabling,
} = storeToRefs(homeStore);

const isDisableConfirmOpen = ref(false);

const badge = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return { className: 'is-enabled', label: '已开启' };
  }

  if (autoFillStatus.value === 'expired') {
    return { className: 'is-expired', label: '已过期' };
  }

  return { className: 'is-disabled', label: '未开启' };
});

function onConfirmDisable(): void {
  isDisableConfirmOpen.value = false;
  void homeStore.disableAutoFill();
}
</script>

<template>
  <section class="wfa-card">
    <div class="wfa-card__head">
      <button
        type="button"
        class="wfa-card__title-btn"
        title="打开自动填报设置"
        @click="homeStore.openAutoFillDialog()"
      >
        自动填报
      </button>
      <span class="wfh-badge" :class="badge.className">
        <span class="wfh-dot" aria-hidden="true"></span>
        {{ badge.label }}
      </span>
    </div>

    <template v-if="autoFillConfig">
      <dl class="wfa-auto__grid">
        <div v-for="item in autoOverviewItems" :key="item.label" class="wfa-auto__item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
      <p v-if="autoFillExecutionText" class="wfa-auto__exec">最近执行：{{ autoFillExecutionText }}</p>
    </template>

    <p v-else class="wfa-auto__empty">尚未配置自动填报，设置后每天定时提交。</p>

    <div class="wfa-auto__actions">
      <button
        type="button"
        class="wfa-auto__btn wfa-auto__btn--primary"
        :disabled="!autoFillConfig || isAutoFillTriggering"
        @click="homeStore.runAutoFillNow()"
      >
        {{ isAutoFillTriggering ? '执行中…' : '立即执行' }}
      </button>
      <button type="button" class="wfa-auto__btn" @click="homeStore.openAutoFillDialog()">
        修改
      </button>
      <button
        type="button"
        class="wfa-auto__btn wfa-auto__btn--danger"
        :disabled="!autoFillConfig || autoFillStatus !== 'enabled' || isAutoFillDisabling"
        @click="isDisableConfirmOpen = true"
      >
        {{ isAutoFillDisabling ? '停用中…' : '停用' }}
      </button>
    </div>

    <ConfirmDialog
      :open="isDisableConfirmOpen"
      title="停用自动填报"
      message="停用后将不再自动执行填报，可随时重新开启。"
      confirm-text="确认停用"
      danger
      @confirm="onConfirmDisable"
      @cancel="isDisableConfirmOpen = false"
    />
  </section>
</template>

<style scoped>
.wfa-auto__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.wfa-auto__item {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
}

.wfa-auto__item dt {
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}

.wfa-auto__item dd {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

.wfa-auto__empty {
  margin: 0;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  font-size: 0.76rem;
  line-height: 1.6;
}

.wfa-auto__exec {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}

.wfa-auto__actions {
  display: flex;
  gap: 0.5rem;
}

.wfa-auto__btn {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.45rem 0.6rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.wfa-auto__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wfa-auto__btn--primary {
  border-color: color-mix(in srgb, var(--color-primary) 45%, white);
  background: transparent;
  color: var(--color-primary);
}

.wfa-auto__btn--primary:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.wfa-auto__btn--danger {
  border-color: color-mix(in srgb, var(--color-danger) 32%, white);
  color: var(--color-danger);
}

/* 顶栏徽标同款状态点，左栏复用 */
.wfh-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
}

.wfh-badge.is-enabled {
  color: var(--color-success);
}

.wfh-badge.is-expired {
  color: var(--color-warning);
}

.wfh-badge.is-disabled {
  color: var(--color-text-tertiary);
}

.wfh-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--color-text-tertiary);
}

.wfh-badge.is-enabled .wfh-dot {
  background: var(--color-success);
}

.wfh-badge.is-expired .wfh-dot {
  background: var(--color-warning);
}
</style>
