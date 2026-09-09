<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';

import { useIsMobile } from '../../composables/useIsMobile';
import { useAuthStore } from '../../stores/auth';
import { useHomeStore } from '../../stores/home';

const homeStore = useHomeStore();
const authStore = useAuthStore();
const isMobile = useIsMobile();
const subtitle = ref('工时填报工作台');
const {
  board,
  weekRange,
  isCurrentWeek,
  isWeekLoading,
  autoFillStatus,
} = storeToRefs(homeStore);

const userMeta = computed(() => {
  const name = board.value?.userName ?? '';
  const dept = board.value?.deptName ?? '';
  return [name, dept].filter(Boolean).join(' · ');
});

const autoFillBadge = computed(() => {
  if (autoFillStatus.value === 'enabled') {
    return { className: 'is-enabled', label: '已开启' };
  }

  if (autoFillStatus.value === 'expired') {
    return { className: 'is-expired', label: '已过期' };
  }

  return { className: 'is-disabled', label: '未开启' };
});

onMounted(async () => {
  try {
    const response = await fetch('https://hi.logacg.com/?z=20');
    const data: unknown = await response.json();
    if (
      response.ok &&
      typeof data === 'object' &&
      data !== null &&
      'hitokoto' in data &&
      typeof data.hitokoto === 'string' &&
      data.hitokoto.trim()
    ) {
      subtitle.value = data.hitokoto;
    }
  } catch {
    // 接口不可用时保留默认文案，不影响填报主流程。
  }
});
</script>

<template>
  <header class="wfh-bar">
    <div class="wfh-bar__inner">
      <div class="wfh-bar__brand">
        <!-- <span class="wfh-bar__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span> -->
        <div class="wfh-bar__brand-text">
          <p class="wfh-eyebrow">云上工时</p>
          <p class="wfh-bar__subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div class="wfh-bar__actions">
        <div class="wfh-nav" role="group" aria-label="周次导航">
          <button
            type="button"
            :disabled="isWeekLoading"
            title="上一周"
            @click="homeStore.switchWeekAndReset('previous')"
          >‹ 上一周</button>
          <button
            type="button"
            class="is-current"
            :disabled="isWeekLoading || isCurrentWeek"
            :title="isCurrentWeek ? '已处于本周' : '回到本周'"
            @click="homeStore.switchWeekAndReset('current')"
          >本周</button>
          <button
            type="button"
            :disabled="isWeekLoading"
            title="下一周"
            @click="homeStore.switchWeekAndReset('next')"
          >下一周 ›</button>
        </div>

        <p class="wfh-range">{{ weekRange || '加载中…' }}</p>

        <span class="wfh-divider" aria-hidden="true"></span>

        <button
          type="button"
          class="wfh-autofill"
          title="打开自动填报设置"
          @click="homeStore.openAutoFillDialog()"
        >
          自动填报
          <span class="wfh-badge" :class="autoFillBadge.className">
            <span class="wfh-dot" aria-hidden="true"></span>
            {{ autoFillBadge.label }}
          </span>
        </button>

        <RouterLink to="/notifications" class="wfh-notify" title="通知管理">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10.3 20a2 2 0 0 0 3.4 0" stroke-linecap="round" />
          </svg>
          通知
        </RouterLink>

        <template v-if="userMeta">
          <span class="wfh-divider" aria-hidden="true"></span>
          <p class="wfh-meta">{{ userMeta }}</p>
        </template>

        <button
          type="button"
          class="wfh-logout"
          title="退出登录"
          @click="authStore.logout()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M16 17l5-5-5-5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="wfh-btn-text">退出</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.wfh-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-blur);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.wfh-bar__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0.6rem 1.8rem;
}

.wfh-bar__brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.wfh-bar__logo {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.wfh-bar__logo svg {
  width: 1.15rem;
  height: 1.15rem;
}

.wfh-bar__brand-text {
  min-width: 0;
}

.wfh-eyebrow {
  margin: 0 0 0.15rem;
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.wfh-bar__subtitle {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wfh-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem 0.6rem;
}

.wfh-nav {
  display: flex;
  gap: 0.4rem;
}

.wfh-nav button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.4rem 0.8rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}

.wfh-nav button.is-current {
  border-color: var(--color-border-strong);
  background: color-mix(in srgb, var(--color-primary) 10%, white);
  color: var(--color-primary);
  font-weight: 600;
}

.wfh-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wfh-range {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.wfh-divider {
  width: 1px;
  height: 1.4rem;
  background: var(--color-border);
}

.wfh-autofill,
.wfh-notify {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.34rem 0.85rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.wfh-autofill:hover,
.wfh-notify:hover {
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.wfh-notify svg {
  width: 0.95rem;
  height: 0.95rem;
}

.wfh-logout {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.34rem 0.85rem;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  white-space: nowrap;
  cursor: pointer;
}

.wfh-logout:hover {
  border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  color: var(--color-danger);
}

.wfh-logout svg {
  width: 0.95rem;
  height: 0.95rem;
}

.wfh-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
}

.wfh-badge.is-enabled {
  color: var(--color-success);
}

.wfh-badge.is-expired {
  color: var(--color-warning);
}

.wfh-badge.is-disabled {
  color: var(--color-text-tertiary);
}

.wfh-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--color-text-tertiary);
}

.wfh-badge.is-enabled .wfh-dot {
  background: var(--color-success);
}

.wfh-badge.is-expired .wfh-dot {
  background: var(--color-warning);
}

.wfh-meta {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* 窄屏：品牌行与操作行各占一行，周切换保持可点；隐藏装饰性元素压缩顶栏 */
@media (max-width: 767px) {
  .wfh-bar {
    padding-top: var(--safe-top);
  }

  .wfh-range{
    display: none;
  }

  .wfh-bar__inner {
    padding: 0.45rem 0.9rem;
    gap: 0.4rem;
  }

  /* 隐藏一言副标题，保留「云上工时」品牌 */
  .wfh-bar__brand {
    display: none;
  }

  .wfh-bar__actions {
    width: 100%;
    justify-content: space-between;
  }

  .wfh-nav button {
    padding: 0.35rem 0.6rem;
    min-height: 36px;
    font-size: 0.85rem;
  }

  .wfh-range {
    font-size: 0.85rem;
  }

  .wfh-divider {
    display: none;
  }

  /* 隐藏用户名·部门 */
  .wfh-meta {
    display: none;
  }

  /* 隐藏「通知」「退出」文字，只保留图标 */
  .wfh-btn-text {
    display: none;
  }
  
  .wfh-autofill,
  .wfh-logout {
    min-height: 36px;
    font-size: 0;
  }

  /* 「自动填报」保留文字，仅缩小徽标字号 */
  .wfh-autofill {
    font-size: 0.78rem;
  }

  .wfh-autofill .wfh-badge {
    display: none;
  }

 
}
</style>
