<script setup lang="ts">
import { computed } from 'vue';
import { useResponsive } from '../../composables/useResponsive';

const { isMobile } = useResponsive();
</script>

<template>
  <div class="board-skeleton">
    <header class="board-skeleton__header">
      <div class="board-skeleton__title">
        <div class="skeleton-line skeleton-line--eyebrow"></div>
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--subtitle"></div>
      </div>
      <div class="board-skeleton__actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </header>

    <div class="board-skeleton__stats">
      <div class="skeleton-stat">
        <div class="skeleton-line skeleton-line--stat"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton-line skeleton-line--stat"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton-line skeleton-line--stat"></div>
      </div>
    </div>

    <div class="board-skeleton__grid" :class="{ 'board-skeleton__grid--mobile': isMobile }">
      <div v-for="i in 7" :key="i" class="skeleton-day">
        <div class="skeleton-line skeleton-line--day-name"></div>
        <div class="skeleton-line skeleton-line--day-date"></div>
        <div class="skeleton-line skeleton-line--day-status"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-skeleton {
  display: grid;
  gap: 1rem;
  border-radius: 30px;
  padding: 1.35rem;
  background: linear-gradient(180deg, rgba(255, 250, 244, 0.9), rgba(240, 233, 224, 0.76));
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.1);
}

.board-skeleton__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.board-skeleton__title {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.board-skeleton__actions {
  display: flex;
  gap: 0.5rem;
}

.skeleton-line {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(19, 38, 40, 0.08);
}

.skeleton-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton-line--eyebrow {
  width: 80px;
  height: 12px;
}

.skeleton-line--title {
  width: 200px;
  height: 32px;
  border-radius: 12px;
}

.skeleton-line--subtitle {
  width: 150px;
  height: 16px;
}

.skeleton-button {
  width: 64px;
  height: 36px;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  position: relative;
  overflow: hidden;
}

.skeleton-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

.board-skeleton__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.48);
}

.skeleton-stat {
  padding-left: 1rem;
  border-left: 1px solid rgba(19, 38, 40, 0.08);
}

.skeleton-stat:first-child {
  padding-left: 0;
  border-left: none;
}

.skeleton-line--stat {
  height: 24px;
  width: 60%;
}

.board-skeleton__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.board-skeleton__grid--mobile {
  grid-template-columns: 1fr;
}

.skeleton-day {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.95rem 0.9rem;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.42);
}

.skeleton-line--day-name {
  height: 20px;
  width: 60%;
}

.skeleton-line--day-date {
  height: 16px;
  width: 80%;
}

.skeleton-line--day-status {
  height: 14px;
  width: 50%;
  margin-top: 0.42rem;
}

@media (max-width: 640px) {
  .board-skeleton {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .board-skeleton__header {
    margin-left: 8px;
  }

  .board-skeleton__stats {
    margin: 0 8px;
  }

  .board-skeleton__grid {
    margin: 0 8px;
  }
}
</style>
