<script setup lang="ts">
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  danger?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: '确认',
  cancelText: '取消',
  loading: false,
  danger: false,
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onConfirm(): void {
  if (props.loading) {
    return;
  }

  emit('confirm');
}

function onCancel(): void {
  emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cd">
      <div v-if="open" class="cd-backdrop" @click.self="onCancel">
        <div class="cd-panel" role="alertdialog" aria-modal="true" :aria-label="title">
          <h2 class="cd-title">{{ title }}</h2>
          <p class="cd-message">{{ message }}</p>
          <div class="cd-actions">
            <button type="button" class="cd-cancel" @click="onCancel">{{ cancelText }}</button>
            <button
              type="button"
              class="cd-confirm"
              :class="{ 'is-danger': danger }"
              :disabled="loading"
              @click="onConfirm"
            >
              {{ loading ? '处理中…' : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
}

.cd-panel {
  display: grid;
  gap: 0.85rem;
  width: 100%;
  max-width: 360px;
  padding: 1.15rem 1.2rem 1.05rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-float);
}

@media (max-width: 640px) {
  .cd-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .cd-panel {
    max-width: none;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
}

.cd-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.cd-message {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.cd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.15rem;
}

.cd-cancel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.55rem 1.05rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
}

.cd-cancel:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.cd-confirm {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.55rem 1.25rem;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.cd-confirm:hover:not(:disabled) {
  background: var(--color-primary-strong);
}

.cd-confirm.is-danger {
  background: var(--color-danger);
}

.cd-confirm.is-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 88%, black);
}

.cd-confirm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* backdrop 淡入淡出 + 面板动画（桌面居中缩放、移动端底部上滑） */
.cd-enter-active,
.cd-leave-active {
  transition: opacity 200ms ease;
}

.cd-enter-active .cd-panel,
.cd-leave-active .cd-panel {
  transition:
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 240ms ease;
}

.cd-enter-from,
.cd-leave-to {
  opacity: 0;
}

.cd-enter-from .cd-panel,
.cd-leave-to .cd-panel {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}

@media (max-width: 640px) {
  .cd-enter-from .cd-panel,
  .cd-leave-to .cd-panel {
    transform: translateY(100%);
  }
}
</style>
