<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { getQrcode, pollStatus } from '../api/dingtalk-client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isLoading } = storeToRefs(authStore);

const qrcode = shallowRef('');
const taskId = shallowRef('');
const status = shallowRef<'loading' | 'waiting' | 'success' | 'timeout' | 'error'>('loading');
const loginState = shallowRef<'qrcode' | 'auto_login'>('qrcode');
const message = shallowRef('');
let pollTimer: number | null = null;

const heroTitle = computed(() =>
  route.query.reason === 'expired' ? '会话已失效，请重新校验身份。' : '进入工时控制台前，先完成一次安全扫码。',
);
const heroCopy = computed(() =>
  loginState.value === 'auto_login'
    ? '系统正在尝试复用已保存的钉钉授权，若成功会自动恢复用户资料并跳转。'
    : '使用钉钉扫码后，系统会自动换取 gzdata token，并恢复你本周的填报数据。',
);
const statusLabel = computed(() => {
  if (status.value === 'loading') {
    return '准备中';
  }
  if (status.value === 'waiting') {
    return loginState.value === 'auto_login' ? '自动恢复' : '等待扫码';
  }
  if (status.value === 'success') {
    return '已通过';
  }
  if (status.value === 'timeout') {
    return '已过期';
  }
  return '异常';
});

function clearTimer(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function startPolling(): Promise<void> {
  clearTimer();
  pollTimer = window.setInterval(async () => {
    if (!taskId.value) {
      return;
    }

    try {
      const result = await pollStatus(taskId.value);
      if (result.status === 'success' && result.userId) {
        clearTimer();
        status.value = 'success';
        authStore.storeUserId(result.userId);
        const ok = await authStore.hydrateUser(result.userId);
        if (ok) {
          const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
          await router.replace(redirect);
        } else {
          status.value = 'error';
          message.value = '获取用户信息失败，请重新扫码。';
        }
      } else if (result.status === 'timeout') {
        clearTimer();
        status.value = 'timeout';
        message.value = '二维码已过期，请刷新后重新扫码。';
      } else if (result.status === 'error') {
        clearTimer();
        status.value = 'error';
        message.value = '钉钉登录失败，请稍后重试。';
      }
    } catch (error) {
      status.value = 'error';
      message.value = error instanceof Error ? error.message : '查询登录状态失败。';
      clearTimer();
    }
  }, 2000);
}

async function loadQrcode(): Promise<void> {
  clearTimer();
  status.value = 'loading';
  message.value = '';
  qrcode.value = '';
  loginState.value = 'qrcode';

  try {
    const result = await getQrcode();
    taskId.value = result.taskId;
    qrcode.value = result.qrcode;
    loginState.value = result.loginState;
    status.value = 'waiting';
    await startPolling();
  } catch (error) {
    status.value = 'error';
    message.value = error instanceof Error ? error.message : '获取二维码失败。';
  }
}

onMounted(() => {
  void loadQrcode();
});

onUnmounted(() => {
  clearTimer();
});
</script>

<template>
  <main class="login-page">
    <section class="login-page__hero">
      <p class="login-page__eyebrow">DingTalk Gateway</p>
      <h1 class="login-page__title">{{ heroTitle }}</h1>
      <p class="login-page__copy">{{ heroCopy }}</p>

      <div class="login-page__rail">
        <article>
          <span>接入方式</span>
          <strong>钉钉扫码授权</strong>
        </article>
        <article>
          <span>当前状态</span>
          <strong>{{ statusLabel }}</strong>
        </article>
        <article>
          <span>成功后跳转</span>
          <strong>工时控制台</strong>
        </article>
      </div>
    </section>

    <section class="login-card">
      <div class="login-card__header">
        <div>
          <p class="login-card__eyebrow">Identity Checkpoint</p>
          <h2 class="login-card__title">扫码登录</h2>
        </div>
        <span class="login-card__badge" :class="`is-${status}`">{{ statusLabel }}</span>
      </div>

      <div class="login-card__frame">
        <div v-if="status === 'loading'" class="login-card__state">正在获取二维码...</div>
        <img v-else-if="qrcode" :src="`data:image/png;base64,${qrcode}`" alt="钉钉登录二维码" />
        <div v-else-if="loginState === 'auto_login' && status === 'waiting'" class="login-card__state">
          检测到已登录状态，正在自动完成授权...
        </div>
        <div v-else class="login-card__state">{{ message || '二维码暂不可用。' }}</div>
      </div>

      <p class="login-card__hint">
        {{
          isLoading
            ? '登录成功，正在恢复用户信息。'
            : status === 'waiting'
              ? loginState === 'auto_login'
                ? '系统正在复用钉钉登录状态，授权成功后会自动跳转。'
                : '请使用钉钉扫码完成授权，成功后会自动恢复数据。'
              : status === 'success'
                ? '登录成功，正在恢复用户信息。'
                : message || '如页面停滞，可手动刷新二维码重试。'
        }}
      </p>

      <button class="login-card__button" type="button" @click="loadQrcode">
        {{ status === 'loading' ? '处理中...' : '刷新二维码' }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: clamp(1rem, 3vw, 2rem);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 420px);
  gap: 1.2rem;
  align-items: stretch;
}

.login-page__hero,
.login-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: 30px;
  padding: clamp(1.2rem, 2.5vw, 2rem);
  background: linear-gradient(180deg, rgba(255, 251, 245, 0.82), rgba(240, 233, 224, 0.7));
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.12);
  backdrop-filter: blur(16px);
}

.login-page__hero::before,
.login-card::before {
  content: '';
  position: absolute;
  inset: 1rem;
  border: 1px solid rgba(19, 38, 40, 0.08);
  border-radius: 22px;
  pointer-events: none;
}

.login-page__hero {
  display: grid;
  align-content: space-between;
  min-height: min(44rem, calc(100vh - 4rem));
  background:
    linear-gradient(135deg, rgba(22, 57, 60, 0.94), rgba(28, 39, 40, 0.84)),
    radial-gradient(circle at top right, rgba(208, 147, 62, 0.22), transparent 32%);
  color: rgba(255, 248, 238, 0.92);
}

.login-page__eyebrow,
.login-card__eyebrow {
  margin: 0 0 0.65rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.login-page__title {
  max-width: 16ch;
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.92;
}

.login-page__copy {
  max-width: 32rem;
  margin-top: 1rem;
  color: rgba(255, 245, 232, 0.74);
  font-size: 1.04rem;
  line-height: 1.75;
}

.login-page__rail {
  margin-top: 2rem;
  display: grid;
  gap: 0.8rem;
}

.login-page__rail article {
  display: grid;
  gap: 0.2rem;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.login-page__rail span {
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 245, 232, 0.56);
}

.login-page__rail strong {
  font-family: var(--font-display);
  font-size: 1.02rem;
  font-weight: 600;
}

.login-card {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.login-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.login-card__title {
  font-size: 1.9rem;
}

.login-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(19, 38, 40, 0.08);
  font-family: var(--font-display);
  font-size: 0.86rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.login-card__badge.is-success {
  background: rgba(35, 112, 82, 0.14);
  color: #1e654c;
}

.login-card__badge.is-error,
.login-card__badge.is-timeout {
  background: rgba(170, 71, 55, 0.12);
  color: var(--danger);
}

.login-card__frame {
  width: min(100%, 310px);
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(233, 227, 218, 0.76));
  border: 1px solid var(--line-soft);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.58);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.login-card__frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-card__state,
.login-card__hint {
  color: var(--ink-soft);
  line-height: 1.7;
}

.login-card__state {
  padding: 1.5rem;
  text-align: center;
}

.login-card__button {
  border: 0;
  border-radius: 999px;
  min-height: 3.25rem;
  padding: 0.85rem 1.2rem;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.login-card__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 24px rgba(15, 44, 47, 0.18);
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-page__hero {
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .login-card__header {
    flex-direction: column;
  }

  .login-card__frame {
    width: 100%;
  }
}
</style>
