<script setup lang="ts">
import type { UserInfo } from '../../types/user';

defineProps<{
  userInfo: UserInfo | null;
  isLoading: boolean;
}>();

defineEmits<{
  logout: [];
}>();
</script>

<template>
  <section class="panel user-panel">
    <div v-if="isLoading" class="user-panel__loading">正在获取用户信息...</div>
    <div v-else-if="userInfo" class="user-panel__content">
      <div>
        <p class="user-panel__eyebrow">当前登录</p>
        <h1 class="user-panel__name">{{ userInfo.nickname }}</h1>
        <p class="user-panel__meta">{{ userInfo.department }}</p>
        <p class="user-panel__meta">状态：{{ userInfo.statusText }}</p>
      </div>
      <button class="user-panel__logout" type="button" @click="$emit('logout')">退出登录</button>
    </div>
    <div v-else class="user-panel__loading">当前没有可用登录态。</div>
  </section>
</template>

<style scoped>
.panel {
  border-radius: 24px;
  background: linear-gradient(145deg, #0f4f53, #163a47);
  color: #fff9ef;
  padding: 1.2rem;
  box-shadow: 0 16px 40px rgba(15, 61, 62, 0.18);
}

.user-panel__content {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.user-panel__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.72;
}

.user-panel__name {
  margin: 0;
  font-size: 1.5rem;
}

.user-panel__meta {
  margin: 0.25rem 0 0;
  opacity: 0.84;
}

.user-panel__logout {
  border: 0;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
  cursor: pointer;
}

.user-panel__loading {
  min-height: 76px;
  display: grid;
  place-items: center;
  opacity: 0.84;
}

@media (max-width: 680px) {
  .user-panel__content {
    flex-direction: column;
  }
}
</style>
