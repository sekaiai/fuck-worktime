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
  <section class="user-panel">
    <div v-if="isLoading" class="user-panel__loading">正在恢复用户身份...</div>
    <div v-else-if="userInfo" class="user-panel__content">
      <div class="user-panel__meta">
        <p class="user-panel__eyebrow">Authenticated User</p>
        <h2 class="user-panel__name">{{ userInfo.nickname }}</h2>
        <p class="user-panel__department">{{ userInfo.department }}</p>
      </div>

      <div class="user-panel__facts">
        <article>
          <span>手机号</span>
          <strong>{{ userInfo.phone || '未提供' }}</strong>
        </article>
        <article>
          <span>用户 ID</span>
          <strong>{{ userInfo.userId }}</strong>
        </article>
      </div>

      <button class="user-panel__logout" type="button" @click="$emit('logout')">退出登录</button>
    </div>
    <div v-else class="user-panel__loading">当前没有可用登录态。</div>
  </section>
</template>

<style scoped>
.user-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 30px;
  padding: 1.25rem;
  background:
    linear-gradient(135deg, rgba(16, 44, 47, 0.96), rgba(33, 50, 53, 0.86)),
    radial-gradient(circle at right top, rgba(208, 147, 62, 0.22), transparent 34%);
  color: rgba(255, 248, 238, 0.92);
  box-shadow: 0 24px 44px rgba(20, 41, 44, 0.16);
}

.user-panel::before {
  content: '';
  position: absolute;
  inset: 1rem;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.user-panel__content {
  display: grid;
  gap: 1rem;
}

.user-panel__eyebrow {
  margin: 0 0 0.45rem;
  color: rgba(225, 175, 103, 0.88);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.user-panel__name {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
}

.user-panel__department {
  margin-top: 0.35rem;
  color: rgba(255, 245, 232, 0.68);
}

.user-panel__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.user-panel__facts article {
  display: grid;
  gap: 0.2rem;
  border-radius: 18px;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.06);
}

.user-panel__facts span {
  color: rgba(255, 245, 232, 0.54);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.user-panel__facts strong {
  font-family: var(--font-display);
  font-size: 1rem;
}

.user-panel__logout {
  justify-self: start;
  border: 0;
  border-radius: 999px;
  min-height: 2.85rem;
  padding: 0.72rem 1rem;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  cursor: pointer;
}

.user-panel__loading {
  min-height: 140px;
  display: grid;
  place-items: center;
  color: rgba(255, 245, 232, 0.68);
}

@media (max-width: 640px) {
  .user-panel__facts {
    grid-template-columns: 1fr;
  }
}
</style>
