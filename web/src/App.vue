<script setup lang="ts">
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

import AppToast from './components/common/AppToast.vue';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const authStore = useAuthStore();
const { isRestoring, userInfo } = storeToRefs(authStore);

const shouldBlockView = computed(
  () => Boolean(route.meta.requiresAuth) && isRestoring.value && !userInfo.value,
);

watch(
  () => [route.fullPath, route.meta.requiresAuth] as const,
  async ([, requiresAuth]) => {
    if (!requiresAuth) {
      return;
    }

    await authStore.restoreAuth();
  },
  { immediate: true },
);
</script>

<template>
  <div class="app-shell">
    <div class="app-shell__mesh app-shell__mesh--blue"></div>
    <div class="app-shell__mesh app-shell__mesh--sky"></div>
    <div class="app-shell__grid"></div>

    <RouterView v-slot="{ Component }">
      <Transition name="app-view" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <Transition name="auth-veil">
      <div v-if="shouldBlockView" class="app-shell__auth-veil">
        <div class="app-shell__auth-card">
          <strong>登录中</strong>
          <p>正在同步用户资料，请稍候。</p>
        </div>
      </div>
    </Transition>

    <AppToast />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  padding-bottom: var(--safe-bottom);
}

.app-shell__mesh,
.app-shell__grid {
  position: fixed;
  inset: 116px 0 0;
  pointer-events: none;
}

.app-shell__mesh {
  filter: blur(72px);
  opacity: 0.28;
}

.app-shell__mesh--blue {
  top: -12rem;
  left: -6rem;
  width: 38rem;
  height: 38rem;
  background: radial-gradient(circle, rgba(52, 110, 245, 0.16), transparent 68%);
}

.app-shell__mesh--sky {
  right: -8rem;
  bottom: -10rem;
  width: 34rem;
  height: 34rem;
  background: radial-gradient(circle, rgba(29, 122, 252, 0.1), transparent 72%);
}

.app-shell__grid {
  background-image:
    linear-gradient(rgba(100, 116, 139, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 116, 139, 0.06) 1px, transparent 1px);
  background-size: 2rem 2rem;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent 88%);
}

.app-shell__auth-veil {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(244, 247, 251, 0.74);
  backdrop-filter: blur(8px);
}

.app-shell__auth-card {
  display: grid;
  gap: 0.45rem;
  min-width: min(100%, 280px);
  padding: 1.2rem 1.25rem;
  border-radius: 24px;
  background: var(--color-bg-panel);
  box-shadow: var(--shadow-soft);
}

.app-shell__auth-card strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.app-shell__auth-card p {
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.6;
}

.app-view-enter-active,
.app-view-leave-active,
.auth-veil-enter-active,
.auth-veil-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.app-view-enter-from,
.app-view-leave-to,
.auth-veil-enter-from,
.auth-veil-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
