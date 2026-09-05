import { ref } from 'vue';

export function usePwaDetect() {
  const isPwa = ref(false);

  if (typeof window !== 'undefined') {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
    const referrerCheck = document.referrer.includes('android-app://');
    isPwa.value = standalone || iosStandalone || referrerCheck;
  }

  return { isPwa };
}
