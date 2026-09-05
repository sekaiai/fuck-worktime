<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';

import ConfirmDialog from '../common/ConfirmDialog.vue';
import { useHomeStore } from '../../stores/home';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const homeStore = useHomeStore();
const {
  projects,
  autoFillConfig,
  autoFillStatus,
  autoFillExecutionText,
  autoProjectId,
  autoWorkTypeGroupId,
  autoItemId,
  autoHours,
  autoWork,
  autoReportTime,
  autoDeadline,
  autoWorkTypeGroups,
  autoAvailableWorkTypes,
  autoOverviewItems,
  isAutoFillSaving,
  isAutoFillTriggering,
  isAutoFillDisabling,
} = storeToRefs(homeStore);

const isDisableConfirmOpen = ref(false);

function onClose(): void {
  emit('close');
}

function onProjectChange(event: Event): void {
  void homeStore.setAutoProject((event.target as HTMLSelectElement).value);
}

function onWorkTypeGroupChange(event: Event): void {
  homeStore.setAutoWorkTypeGroup((event.target as HTMLSelectElement).value);
}

function onItemChange(event: Event): void {
  homeStore.setAutoItem((event.target as HTMLSelectElement).value);
}

function onHoursInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  homeStore.setAutoHours(Number.isFinite(value) ? value : 0);
}

function onWorkInput(event: Event): void {
  homeStore.setAutoWork((event.target as HTMLTextAreaElement).value);
}

function onReportTimeInput(event: Event): void {
  homeStore.setAutoReportTime((event.target as HTMLInputElement).value);
}

function onDeadlineInput(event: Event): void {
  homeStore.setAutoDeadline((event.target as HTMLInputElement).value);
}

function onClearDeadline(): void {
  homeStore.setAutoDeadline('');
}

function onSave(): void {
  void homeStore.saveAutoFillConfig();
}

function onRunNow(): void {
  void homeStore.runAutoFillNow();
}

function onDisable(): void {
  isDisableConfirmOpen.value = true;
}

function onConfirmDisable(): void {
  isDisableConfirmOpen.value = false;
  void homeStore.disableAutoFill();
}

function onCancelDisable(): void {
  isDisableConfirmOpen.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="afd">
      <div v-if="open" class="afd-backdrop" @click.self="onClose">
        <div class="afd-panel" role="dialog" aria-modal="true" aria-label="自动填报">
          <header class="afd-header">
            <h2 class="afd-title">自动填报</h2>
            <button type="button" class="afd-close" aria-label="关闭" @click="onClose">✕</button>
          </header>

          <section v-if="autoFillConfig" class="afd-overview">
            <dl class="afd-overview__grid">
              <div v-for="item in autoOverviewItems" :key="item.label" class="afd-overview__item">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
            <p v-if="autoFillExecutionText" class="afd-overview__exec">
              最近执行：{{ autoFillExecutionText }}
            </p>
          </section>

          <form class="afd-form" @submit.prevent>
            <label class="afd-field">
              <span>项目</span>
              <select :value="autoProjectId" @change="onProjectChange">
                <option value="">选择项目</option>
                <option v-for="project in projects" :key="project.id" :value="project.id">
                  {{ project.title }}
                </option>
              </select>
            </label>

            <label class="afd-field">
              <span>一级工时类型</span>
              <select :value="autoWorkTypeGroupId" @change="onWorkTypeGroupChange">
                <option value="">选择一级工时类型</option>
                <option v-for="group in autoWorkTypeGroups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
              </select>
            </label>

            <label class="afd-field">
              <span>二级工时类型</span>
              <select :value="autoItemId" :disabled="!autoWorkTypeGroupId" @change="onItemChange">
                <option value="">选择二级工时类型</option>
                <option v-for="workType in autoAvailableWorkTypes" :key="workType.id" :value="workType.id">
                  {{ workType.name }}
                </option>
              </select>
            </label>

            <label class="afd-field">
              <span>每日工时</span>
              <input type="number" min="0.5" step="0.5" :value="autoHours" @input="onHoursInput" />
            </label>

            <label class="afd-field afd-field--full">
              <span>工作内容</span>
              <textarea
                rows="3"
                placeholder="例如：完成工作台重构与联调"
                :value="autoWork"
                @input="onWorkInput"
              ></textarea>
            </label>

            <label class="afd-field">
              <span>填报时间</span>
              <input type="time" :value="autoReportTime" @input="onReportTimeInput" />
            </label>

            <div class="afd-field">
              <span>截止日期</span>
              <div class="afd-deadline">
                <input type="date" :value="autoDeadline" @input="onDeadlineInput" />
                <button type="button" class="afd-clear" @click.stop.prevent="onClearDeadline">清空</button>
              </div>
            </div>
          </form>

          <footer class="afd-actions">
            <button type="button" class="afd-save" :disabled="isAutoFillSaving" @click="onSave">
              {{ isAutoFillSaving ? '保存中…' : '保存' }}
            </button>
            <button
              v-if="autoFillConfig"
              type="button"
              class="afd-run"
              :disabled="isAutoFillTriggering"
              @click="onRunNow"
            >
              {{ isAutoFillTriggering ? '执行中…' : '立即执行' }}
            </button>
            <button
              v-if="autoFillConfig && autoFillStatus === 'enabled'"
              type="button"
              class="afd-disable"
              :disabled="isAutoFillDisabling"
              @click="onDisable"
            >
              停用
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog
    :open="isDisableConfirmOpen"
    title="停用自动填报"
    message="停用后将不再自动执行填报，可随时重新开启。"
    confirm-text="确认停用"
    danger
    @confirm="onConfirmDisable"
    @cancel="onCancelDisable"
  />
</template>

<style scoped>
.afd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
}

.afd-panel {
  display: grid;
  gap: 1rem;
  width: 100%;
  max-width: 480px;
  max-height: 86dvh;
  overflow-y: auto;
  padding: 1.2rem 1.2rem 1.1rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-float);
}

@media (max-width: 640px) {
  .afd-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .afd-panel {
    max-width: none;
    max-height: 92dvh;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
}

.afd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.afd-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.afd-close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 0.95rem;
  cursor: pointer;
}

.afd-close:hover {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
}

.afd-overview {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 0.95rem;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.afd-overview__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 1rem;
  margin: 0;
}

.afd-overview__item dt {
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}

.afd-overview__item dd {
  margin: 0.1rem 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  word-break: break-word;
}

.afd-overview__exec {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.afd-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem 0.85rem;
}

.afd-field {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.afd-field--full {
  grid-column: 1 / -1;
}

.afd-field > span {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.afd-field select,
.afd-field input,
.afd-field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.6rem;
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: 0.82rem;
}

.afd-field select:focus,
.afd-field input:focus,
.afd-field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.afd-field textarea {
  resize: vertical;
  line-height: 1.55;
}

@media (max-width: 640px) {
  .afd-form {
    grid-template-columns: minmax(0, 1fr);
  }
}

.afd-deadline {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.afd-deadline input {
  flex: 1;
  min-width: 0;
}

.afd-clear {
  flex: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.42rem 0.65rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.afd-clear:hover {
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.afd-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.afd-save {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.6rem 1.3rem;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.afd-save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.afd-run {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1.1rem;
  background: var(--color-bg-panel);
  color: var(--color-primary);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.afd-run:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.afd-disable {
  border: 0;
  padding: 0.6rem 0.5rem;
  background: transparent;
  color: var(--color-danger);
  font-size: 0.85rem;
  cursor: pointer;
}

.afd-disable:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* backdrop 淡入淡出 + 面板动画（桌面居中缩放、移动端底部上滑） */
.afd-enter-active,
.afd-leave-active {
  transition: opacity 220ms ease;
}

.afd-enter-active .afd-panel,
.afd-leave-active .afd-panel {
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease;
}

.afd-enter-from,
.afd-leave-to {
  opacity: 0;
}

.afd-enter-from .afd-panel,
.afd-leave-to .afd-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.97);
}

@media (max-width: 640px) {
  .afd-enter-from .afd-panel,
  .afd-leave-to .afd-panel {
    transform: translateY(100%);
  }
}
</style>
