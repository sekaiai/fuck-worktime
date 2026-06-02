import { computed, onMounted, onUnmounted, ref } from 'vue';

export function useResponsive() {
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200);

  const updateWidth = () => {
    if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth;
    }
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidth);
      updateWidth();
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateWidth);
    }
  });

  const isMobile = computed(() => windowWidth.value < 640);
  const isTablet = computed(() => windowWidth.value >= 640 && windowWidth.value < 1024);
  const isDesktop = computed(() => windowWidth.value >= 1024);

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
  };
}
