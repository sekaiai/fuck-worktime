<script setup lang="ts">
import { useToastState } from '../../composables/useToast';

const toast = useToastState();
</script>

<template>
  <Transition name="app-toast">
    <div
      v-if="toast"
      class="app-toast"
      :class="`app-toast--${toast.type}`"
      role="status"
      aria-live="polite"
    >
      <span class="app-toast__icon" aria-hidden="true">
        <svg v-if="toast.type === 'success'" viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else-if="toast.type === 'error'" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3.5v6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="8" cy="12.6" r="1.15" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3.9" r="1.15" fill="currentColor" />
          <path
            d="M8 6.5v6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <span class="app-toast__text">{{ toast.message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  max-width: min(92vw, 30rem);
  padding: 0.78rem 0.95rem;
  border-radius: var(--radius-lg);
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
  pointer-events: none;
}

.app-toast__icon {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.05rem;
  border-radius: 999px;
}

.app-toast__icon svg {
  width: 0.85rem;
  height: 0.85rem;
}

.app-toast__text {
  white-space: pre-line;
  word-break: break-word;
  font-size: 0.88rem;
  line-height: 1.5;
}

.app-toast--success .app-toast__icon {
  background: rgba(34, 197, 94, 0.24);
  color: #4ade80;
}

.app-toast--error .app-toast__icon {
  background: rgba(248, 113, 113, 0.24);
  color: #f87171;
}

.app-toast--info .app-toast__icon {
  background: rgba(96, 165, 250, 0.24);
  color: #60a5fa;
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
</style>
