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
  <section class="user-info">
    <div v-if="isLoading" class="user-info__loading">
      <div class="user-info__skeleton"></div>
    </div>

    <div v-else-if="userInfo" class="user-info__content">
      <div class="user-info__avatar">
        <nut-icon name="my" size="24" color="#fff"></nut-icon>
      </div>
      <div class="user-info__detail">
        <span class="user-info__name">{{ userInfo.nickname || '未知用户' }}</span>
        <span class="user-info__dept">{{ userInfo.deptName || '未知部门' }}</span>
      </div>
      <nut-button type="default" size="small" class="user-info__logout" @click="$emit('logout')">
        退出
      </nut-button>
    </div>

    <div v-else class="user-info__empty">
      <span class="user-info__empty-text">未获取到用户信息</span>
    </div>
  </section>
</template>

<style scoped>
.user-info {
  background: linear-gradient(135deg, #0f3d3e 0%, #1a5c5e 100%);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  color: #fff;
}

.user-info__loading {
  padding: 0.5rem 0;
}

.user-info__skeleton {
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.user-info__content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-info__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info__detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-info__name {
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info__dept {
  font-size: 0.8rem;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info__logout {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #fff !important;
}

.user-info__empty-text {
  font-size: 0.9rem;
  opacity: 0.7;
}
</style>
