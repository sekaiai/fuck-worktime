import { ref } from 'vue';
import type { Ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 2600,
  error: 5000,
  info: 2600,
};

// 模块级单例状态：全局仅一条 toast，新消息覆盖旧消息并重置计时
const toastState = ref<ToastState | null>(null);
let toastTimer: number | null = null;
let toastSeq = 0;

export function showToast(message: string, type: ToastType = 'info'): void {
  if (!message.trim()) {
    return;
  }

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastSeq += 1;
  toastState.value = { id: toastSeq, message, type };

  toastTimer = window.setTimeout(() => {
    toastState.value = null;
    toastTimer = null;
  }, TOAST_DURATION_MS[type]);
}

export function useToastState(): Readonly<Ref<ToastState | null>> {
  return toastState;
}
