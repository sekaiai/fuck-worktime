import { shallowRef } from 'vue';

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

  return {
    message,
    show,
  };
}
