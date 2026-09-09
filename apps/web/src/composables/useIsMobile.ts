import { onScopeDispose, ref } from 'vue';

const MOBILE_QUERY = '(max-width: 767px)';

let refCount = 0;
let mediaQuery: MediaQueryList | null = null;
let active = ref(false);

function sync(): void {
  active.value = mediaQuery!.matches;
}

function attach(): void {
  if (refCount === 0) {
    mediaQuery = window.matchMedia(MOBILE_QUERY);
    sync();
    mediaQuery.addEventListener('change', sync);
  }
  refCount += 1;
}

function detach(): void {
  refCount -= 1;
  if (refCount <= 0) {
    refCount = 0;
    mediaQuery?.removeEventListener('change', sync);
    mediaQuery = null;
  }
}

/** 是否处于移动端（≤ 767px）。模块级单例 ref + matchMedia change 监听。 */
export function useIsMobile() {
  attach();

  if (typeof onScopeDispose === 'function') {
    onScopeDispose(detach);
  }

  return active;
}
