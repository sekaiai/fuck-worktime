import { onBeforeUnmount, shallowRef } from 'vue';

export function useToast() {
  const message = shallowRef('');
  let timer: number | null = null;

  function show(nextMessage: string): void {
    message.value = nextMessage;
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      message.value = '';
    }, 2600);
  }

  // 组件卸载后必须清理 timer，否则可能在卸载后仍触发 ref 赋值
  onBeforeUnmount(() => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  });

  return {
    message,
    show,
  };
}
