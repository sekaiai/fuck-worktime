<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goToNotifications = () => {
  router.push('/notifications');
};
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <h1 class="hero-title">云上工时</h1>
      <p class="hero-copy">
        欢迎使用云上工时管理系统
      </p>
      <button class="nav-button" @click="goToNotifications">
        前往消息提醒
      </button>
    </section>
  </main>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  display: grid;
  gap: 2rem;
  align-content: center;
  padding: 2rem;
}

.hero-panel {
  max-width: 720px;
}

.hero-title {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4.5rem);
  line-height: 0.95;
}

.hero-copy {
  max-width: 56ch;
  margin: 1rem 0 2rem;
  color: #355254;
  font-size: 1.05rem;
  line-height: 1.7;
}

.nav-button {
  padding: 0.75rem 1.5rem;
  background: #0f3d3e;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.nav-button:hover {
  background: #1a5a5b;
}
</style>
