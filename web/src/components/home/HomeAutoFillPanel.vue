<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import InlineToast from '../common/InlineToast.vue';
import ResultDialog from '../common/ResultDialog.vue';
import { usePwaDetect } from '../../composables/usePwaDetect';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const router = useRouter();
const { isPwa } = usePwaDetect();
const hasNotificationSubscription = shallowRef(false);
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
    return '已失效';
  }
  return '已禁用';
});

const notificationText = computed(() => {
  if (!hasNotificationSubscription.value) {
    return '前往订阅提醒';
  }

  return isPwa.value ? '已在设备中订阅提醒' : '当前浏览器已订阅提醒';
});

function openNotifications(): void {
  void router.push('/notifications');
}

async function syncNotificationSubscription(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    hasNotificationSubscription.value = false;
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      hasNotificationSubscription.value = false;
      return;
    }

    hasNotificationSubscription.value = (await registration.pushManager.getSubscription()) !== null;
  } catch {
    hasNotificationSubscription.value = false;
  }
}

onMounted(() => {
  void syncNotificationSubscription();
});
</script>

<template>
  <section class="auto-fill-panel" :class="[`is-${autoFillStatus}`, { 'is-open': autoIsOpen }]">
    <div class="auto-fill-panel__glow auto-fill-panel__glow--amber"></div>
    <div class="auto-fill-panel__glow auto-fill-panel__glow--teal"></div>
    <span class="auto-fill-panel__badge auto-fill-panel__badge--floating" :class="`is-${autoFillStatus}`">
      {{ statusText }}
    </span>

    <header class="auto-fill-panel__header">
      <div class="auto-fill-panel__heading">
        <p class="auto-fill-panel__eyebrow">Auto Fill</p>
        <h2 class="auto-fill-panel__title">自动填报策略</h2>
        <p class="auto-fill-panel__copy">
          把项目、工时类型、提交时间和描述模板固定下来，交给系统在工作日按规则自动执行。
        </p>
      </div>
    </header>

    <div v-if="autoOverviewItems.length > 0" class="auto-fill-panel__overview">
      <article
        v-for="item in autoOverviewItems"
        :key="item.label"
        class="auto-fill-panel__metric"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
    <div v-else class="auto-fill-panel__empty">
      <strong>尚未建立策略</strong>
      <p>展开下方工作台后即可完成自动填报配置。</p>
    </div>

    <div class="auto-fill-panel__toolbar">
      <button class="auto-fill-panel__toggle" type="button" @click="homeStore.toggleAutoFillOpen()">
        {{ autoIsOpen ? '收起配置面板' : '展开配置面板' }}
      </button>
      <button
        class="auto-fill-panel__link"
        type="button"
        :class="{ 'is-active': hasNotificationSubscription }"
        @click="openNotifications"
      >
        {{ notificationText }}
      </button>
    </div>

    <Transition name="auto-fill-expand">
      <div v-if="autoIsOpen" class="auto-fill-panel__editor">
        <section class="auto-fill-panel__workspace">
          <div class="auto-fill-panel__form">
            <label class="field">
              <span>项目</span>
              <select :value="autoProjectId" @change="homeStore.setAutoProject(($event.target as HTMLSelectElement).value)">
                <option value="">请选择项目</option>
                <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
              </select>
            </label>

            <label class="field">
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

            <label class="field">
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

            <label class="field">
              <span>工时</span>
              <input
                :value="autoHours"
                type="number"
                min="1"
                max="8"
                placeholder="小时"
                @input="homeStore.setAutoHours(Number(($event.target as HTMLInputElement).value))"
              />
            </label>

            <label class="field">
              <span>填报时间</span>
              <input
                :value="autoReportTime"
                type="time"
                @input="homeStore.setAutoReportTime(($event.target as HTMLInputElement).value)"
              />
            </label>

            <div class="field auto-fill-panel__field">
              <label class="field" for="auto-fill-deadline">
                <span>截止日期</span>
              </label>
              <div class="auto-fill-panel__date-field">
                <input
                  id="auto-fill-deadline"
                  :value="autoDeadline"
                  type="date"
                  @input="homeStore.setAutoDeadline(($event.target as HTMLInputElement).value)"
                />

                <button
                  v-if="autoDeadline"
                  class="auto-fill-panel__date-clear"
                  type="button"
                  @pointerdown.stop.prevent
                  @click.stop.prevent="homeStore.setAutoDeadline('')"
                >
                  清空
                </button>
              </div>
              <p class="auto-fill-panel__field-hint">不填写则长期有效</p>
            </div>

            <label class="field auto-fill-panel__full">
              <span>工作内容模板</span>
              <textarea
                :value="autoWork"
                rows="4"
                placeholder="把你所有工作都写进去AI会随机生成对应的工作内容，你写的越多生成的越好"
                @input="homeStore.setAutoWork(($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </div>

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
              class="auto-fill-panel__secondary danger"
              type="button"
              :disabled="isDisabling"
              @click="homeStore.disableCurrentAutoFillConfig()"
            >
              {{ isDisabling ? '禁用中...' : '禁用策略' }}
            </button>
          </div>
        </section>
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
  overflow: hidden;
  display: grid;
  gap: 1rem;
  border-radius: var(--radius-2xl);
  padding: 1.4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.auto-fill-panel__glow {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(18px);
  opacity: 0.45;
}

.auto-fill-panel__glow--amber {
  top: -3.5rem;
  right: -2rem;
  width: 12rem;
  height: 12rem;
  background: radial-gradient(circle, rgba(52, 110, 245, 0.12), transparent 68%);
}

.auto-fill-panel__glow--teal {
  left: -2rem;
  bottom: -4rem;
  width: 13rem;
  height: 13rem;
  background: radial-gradient(circle, rgba(52, 110, 245, 0.09), transparent 72%);
}

.auto-fill-panel__header,
.auto-fill-panel__overview,
.auto-fill-panel__toolbar,
.auto-fill-panel__editor {
  position: relative;
  z-index: 1;
}

.auto-fill-panel__header {
  display: block;
}

.auto-fill-panel__heading {
  display: grid;
  gap: 0.55rem;
  padding-right: 4.5rem;
}

.auto-fill-panel__eyebrow {
  margin: 0;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.auto-fill-panel__title {
  font-size: clamp(2rem, 4vw, 2.9rem);
  line-height: 0.94;
}

.auto-fill-panel__copy {
  max-width: 34rem;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.75;
}

.auto-fill-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.38rem 0.8rem;
  border-radius: 999px;
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
}

.auto-fill-panel__badge--floating {
  position: absolute;
  top: 1.4rem;
  right: 1.4rem;
  z-index: 2;
}

.auto-fill-panel__badge.is-enabled {
  background: rgba(31, 157, 99, 0.12);
  color: var(--color-success);
}

.auto-fill-panel__badge.is-expired {
  background: rgba(220, 76, 66, 0.1);
  color: var(--color-danger);
}

.auto-fill-panel__overview {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.72rem;
}

.auto-fill-panel__metric {
  display: grid;
  grid-template-columns: minmax(76px, 0.2fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
  padding: 0.95rem 1.05rem;
  border-radius: var(--radius-xl);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
}

.auto-fill-panel__metric span {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auto-fill-panel__metric strong {
  font-family: var(--font-display);
  font-size: 1.06rem;
  line-height: 1.35;
}

.auto-fill-panel__empty {
  display: grid;
  gap: 0.35rem;
  padding: 1.05rem 1.1rem;
  border-radius: var(--radius-xl);
  background: var(--color-bg-panel);
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
}

.auto-fill-panel__empty strong {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-text-primary);
}

.auto-fill-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  padding-inline: 0.15rem;
}

.auto-fill-panel__toggle,
.auto-fill-panel__link,
.auto-fill-panel__primary,
.auto-fill-panel__secondary {
  border: 0;
  border-radius: 999px;
  min-height: 2.95rem;
  padding: 0.78rem 1.05rem;
  font-family: var(--font-display);
  cursor: pointer;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.auto-fill-panel__toggle:disabled,
.auto-fill-panel__link:disabled,
.auto-fill-panel__primary:disabled,
.auto-fill-panel__secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.auto-fill-panel__toggle,
.auto-fill-panel__link,
.auto-fill-panel__secondary {
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
}

.auto-fill-panel__toggle:hover,
.auto-fill-panel__link:hover,
.auto-fill-panel__secondary:hover,
.auto-fill-panel__primary:hover {
  transform: translateY(-1px);
}

.auto-fill-panel__link.is-active {
  background: rgba(31, 157, 99, 0.12);
  color: var(--color-success);
}

.auto-fill-panel__primary {
  background: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(52, 110, 245, 0.22);
}

.auto-fill-panel__secondary.danger {
  background: rgba(220, 76, 66, 0.1);
  color: var(--color-danger);
}

.auto-fill-panel__editor {
  display: grid;
  gap: 1rem;
}

.auto-fill-panel__workspace {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-xl);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.auto-fill-panel__form {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.85rem;
}

.auto-fill-panel__full {
  grid-column: 1 / -1;
}

.auto-fill-panel__date-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}

.auto-fill-panel__field-hint {
  margin: -0.05rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
}

.auto-fill-panel__date-clear {
  border: 0;
  min-height: 2.9rem;
  padding: 0.72rem 0.9rem;
  border-radius: 16px;
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
  font-family: var(--font-display);
  cursor: pointer;
}

.auto-fill-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.4rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--color-border);
}

.auto-fill-expand-enter-active,
.auto-fill-expand-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.auto-fill-expand-enter-from,
.auto-fill-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 1100px) {
  .auto-fill-panel__heading {
    padding-right: 7rem;
  }

  .auto-fill-panel__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .auto-fill-panel {
    padding: 1.1rem;
  }

  .auto-fill-panel__badge--floating {
    top: 1.1rem;
    right: 1.1rem;
  }

  .auto-fill-panel__heading {
    padding-right: 0;
  }

  .auto-fill-panel__metric,
  .auto-fill-panel__form {
    grid-template-columns: 1fr;
  }

  .auto-fill-panel__date-field {
    grid-template-columns: 1fr;
  }

  .auto-fill-panel__toolbar,
  .auto-fill-panel__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .auto-fill-panel__toggle,
  .auto-fill-panel__link,
  .auto-fill-panel__primary,
  .auto-fill-panel__secondary {
    width: 100%;
  }
}
</style>
