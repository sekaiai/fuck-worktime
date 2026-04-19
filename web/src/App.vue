<template>
  <div class="app-shell">
    <div class="app-shell__mesh app-shell__mesh--amber"></div>
    <div class="app-shell__mesh app-shell__mesh--teal"></div>
    <div class="app-shell__grid"></div>

    <RouterView v-slot="{ Component }">
      <Transition name="app-view" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
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

.app-shell__mesh--amber {
  top: -12rem;
  left: -6rem;
  width: 38rem;
  height: 38rem;
  background: radial-gradient(circle, rgba(214, 150, 63, 0.22), transparent 68%);
}

.app-shell__mesh--teal {
  right: -8rem;
  bottom: -10rem;
  width: 34rem;
  height: 34rem;
  background: radial-gradient(circle, rgba(231, 214, 187, 0.42), transparent 72%);
}

.app-shell__grid {
  background-image:
    linear-gradient(rgba(125, 115, 95, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(125, 115, 95, 0.04) 1px, transparent 1px);
  background-size: 2rem 2rem;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent 88%);
}

.app-view-enter-active,
.app-view-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.app-view-enter-from,
.app-view-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
