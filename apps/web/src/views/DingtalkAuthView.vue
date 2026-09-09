<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { getQrcode, pollStatus } from '../api/dingtalk-client';
import { getErrorMessage } from '../api/request';
import { useIsMobile } from '../composables/useIsMobile';
import { useAuthStore } from '../stores/auth';

type LoginStatus = 'loading' | 'waiting' | 'success' | 'timeout' | 'error';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isLoading } = storeToRefs(authStore);
const isMobile = useIsMobile();

const qrcode = shallowRef('');
const taskId = shallowRef('');
const phone = shallowRef('');
const status = shallowRef<LoginStatus>('loading');
const loginState = shallowRef<'qrcode' | 'auto_login'>('qrcode');
const message = shallowRef('');
let pollTimer: number | null = null;

const isExpired = computed(() => route.query.reason === 'expired');

const heroTitle = computed(() =>
  isExpired.value ? '登录信息已失效' : '云上工时系统，非官方。',
);

const heroCopy = computed(() =>
  '主要功能是AI填补、自动填报。这玩意儿只是为了方便我自己填报用的，我不会收集你的任何信息，拿来也没用。',
);

const cardTitle = computed(() => isMobile.value ? '手机号登录' : '扫码登录');

const statusLabel = computed(() => {
  if (status.value === 'loading') {
    return isMobile.value ? '待输入' : '准备中';
  }
  if (status.value === 'waiting') {
    return loginState.value === 'auto_login' ? '自动恢复' : '等待处理';
  }
  if (status.value === 'success') {
    return '已通过';
  }
  if (status.value === 'timeout') {
    return '已过期';
  }
  return '异常';
});

const hintText = computed(() => {
  if (isLoading.value || status.value === 'success') {
    return '登录成功，正在恢复用户信息。';
  }

  if (isMobile.value) {
    if (status.value === 'error') {
      return message.value || '请输入手机号后重试。';
    }

    if (isExpired.value) {
      return '如果提示已失效，请在电脑端重新扫码登录。';
    }

    return '请先在电脑端钉钉扫码登录，然后在这里输入手机号恢复登录状态。';
  }

  if (status.value === 'waiting') {
    return loginState.value === 'auto_login'
      ? '系统正在复用当前钉钉登录状态，授权成功后会自动跳转。'
      : '请使用钉钉扫码完成授权，成功后会自动恢复数据。';
  }

  return message.value || '如页面停滞，可手动刷新二维码重试。';
});

function clearTimer(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * redirect 必须是站内路径，避免开放重定向（例如 `//evil.com` 或 `https://evil.com`）。
 */
function resolveSafeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) {
    return '/';
  }
  // 必须以单个 / 开头，不能以 // 或 /\\ 开头（会被浏览器解析为协议相对/绝对 URL）
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/';
  }
  return raw;
}

async function finishLogin(targetUserId: string): Promise<void> {
  const result = await authStore.hydrateUser(targetUserId);
  if (result.ok) {
    const redirect = resolveSafeRedirect(route.query.redirect);
    await router.replace(redirect);
    return;
  }

  status.value = 'error';
  message.value =
    result.status === 'expired' || result.status === 'refreshing'
      ? '登录信息已失效，请在网页端重新登录。'
      : '获取用户信息失败，请重新登录。';
}

/**
 * 轮询上限：约 2 分钟（60 次 × 2 秒），超过则转为 timeout 状态，
 * 避免后端持续返回 waiting 时无限轮询。
 */
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 2000;

async function startPolling(): Promise<void> {
  clearTimer();
  let attempts = 0;
  pollTimer = window.setInterval(async () => {
    if (!taskId.value) {
      return;
    }

    attempts += 1;
    if (attempts > MAX_POLL_ATTEMPTS) {
      clearTimer();
      status.value = 'timeout';
      message.value = '登录等待超时，请刷新二维码后重试。';
      return;
    }

    try {
      const result = await pollStatus(taskId.value);
      if (result.status === 'success' && result.userId) {
        clearTimer();
        status.value = 'success';
        await finishLogin(result.userId);
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
      message.value = getErrorMessage(error, '查询登录状态失败。');
      clearTimer();
    }
  }, POLL_INTERVAL_MS);
}

async function loadQrcode(): Promise<void> {
  if (isMobile.value) {
    status.value = 'loading';
    message.value = '';
    qrcode.value = '';
    taskId.value = '';
    return;
  }

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
    message.value = getErrorMessage(error, '获取二维码失败。');
  }
}

async function submitPhoneLogin(): Promise<void> {
  const normalizedPhone = phone.value.replace(/[^\d]/g, '');
  if (!normalizedPhone) {
    status.value = 'error';
    message.value = '请输入手机号。';
    return;
  }

  status.value = 'waiting';
  message.value = '';

  const result = await authStore.hydrateUserByPhone(normalizedPhone);
  if (!result.ok) {
    status.value = 'error';
    if (result.status === 'expired' || result.status === 'refreshing') {
      message.value = '登录信息已失效，请在网页端重新登录。';
      return;
    }

    message.value = '未找到该手机号的登录数据，请先在网页上扫码登录。';
    return;
  }

  status.value = 'success';
  const redirect = resolveSafeRedirect(route.query.redirect);
  await router.replace(redirect);
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
    <section v-if="!isMobile" class="login-page__hero">
      <p class="login-page__eyebrow">DingTalk Gateway</p>
      <h1 class="login-page__title">{{ heroTitle }}</h1>
      <p class="login-page__copy">{{ heroCopy }}</p>
    </section>

    <section class="login-card">
      <div class="login-card__header">
        <div>
          <h2 class="login-card__title">{{ cardTitle }}</h2>
        </div>
        <span v-if="statusLabel" class="login-card__badge" :class="`is-${status}`">{{ statusLabel }}</span>
      </div>

      <!-- 手机端：手机号登录 + 前置说明 -->
      <div v-if="isMobile" class="login-card__form">
        <div class="login-card__notice">
          <p class="login-card__notice-title">使用须知</p>
          <p class="login-card__notice-text">
            手机端无法直接注册登录。请先在<strong>电脑端浏览器</strong>打开系统，使用钉钉扫码完成首次登录，然后在这里输入手机号恢复登录状态。
          </p>
        </div>

        <label class="login-card__field">
          <span>手机号</span>
          <input
            v-model.trim="phone"
            class="login-card__input"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="请输入绑定手机号"
            :disabled="isLoading"
            @keyup.enter="submitPhoneLogin"
          />
        </label>

        <button class="login-card__button" type="button" :disabled="isLoading" @click="submitPhoneLogin">
          {{ isLoading ? '处理中...' : '手机号登录' }}
        </button>
      </div>

      <!-- 桌面端：扫码登录 -->
      <div v-else class="login-card__frame">
        <div v-if="status === 'loading'" class="login-card__state">正在获取二维码...</div>
        <img v-else-if="qrcode" :src="`data:image/png;base64,${qrcode}`" alt="钉钉登录二维码" />
        <div v-else-if="loginState === 'auto_login' && status === 'waiting'" class="login-card__state">
          检测到已登录状态，正在自动完成授权...
        </div>
        <div v-else class="login-card__state">{{ message || '二维码暂不可用。' }}</div>
      </div>

      <p class="login-card__hint">{{ hintText }}</p>

      <button
        v-if="!isMobile"
        class="login-card__button"
        type="button"
        :disabled="status === 'loading'"
        @click="loadQrcode"
      >
        {{ status === 'loading' ? '处理中...' : '刷新二维码' }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 420px);
  gap: 1.2rem;
  align-items: stretch;
  padding: clamp(1rem, 3vw, 2rem);
}

.login-page__hero,
.login-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  padding: clamp(1.2rem, 2.5vw, 2rem);
}

.login-page__hero {
  /* display: grid; */
  /* align-content: space-between; */
  min-height: min(44rem, calc(100vh - 4rem));
  background:
    radial-gradient(circle at 82% 10%, rgba(112, 170, 255, 0.32), transparent 38%),
    radial-gradient(circle at 8% 92%, rgba(32, 61, 134, 0.55), transparent 42%),
    linear-gradient(135deg, #203d86, #2455d6);
  color: #ffffff;
}

.login-page__eyebrow,
.login-card__eyebrow {
  margin: 0 0 0.65rem;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.84rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

/* hero 为深蓝底，info 蓝对比度不足（约 2.5:1），提亮为浅蓝保证可读性 */
.login-page__hero .login-page__eyebrow {
  color: rgba(168, 203, 255, 0.92);
}

.login-page__title {
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.92;
  margin-bottom: auto;
}

.login-page__copy {
  max-width: 32rem;
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 1.04rem;
  line-height: 1.75;
}

.login-card {
  display: grid;
  gap: 1rem;
  align-content: start;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
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
  background: rgba(15, 23, 42, 0.06);
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.86rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.login-card__badge.is-success {
  background: rgba(31, 157, 99, 0.12);
  color: var(--color-success);
}

.login-card__badge.is-error,
.login-card__badge.is-timeout {
  background: rgba(220, 76, 66, 0.12);
  color: var(--color-danger);
}

.login-card__form {
  display: grid;
  gap: 0.9rem;
}

.login-card__field {
  display: grid;
  gap: 0.55rem;
}

.login-card__field span {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
}

.login-card__input {
  width: 100%;
  min-height: 3.2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1rem;
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
  font-family: var(--font-body);
}

.login-card__input::placeholder {
  color: var(--color-text-tertiary);
}

.login-card__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.login-card__input:disabled {
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
}

.login-card__frame {
  width: min(100%, 310px);
  aspect-ratio: 1;
  margin: 0 auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  background: var(--color-bg-panel);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.login-card__notice {
  display: grid;
  gap: 0.4rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-primary) 6%, white);
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
}

.login-card__notice-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--color-primary);
}

.login-card__notice-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.65;
}

.login-card__notice-text strong {
  color: var(--color-text-primary);
}

.login-card__frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-card__state,
.login-card__hint {
  color: var(--color-text-tertiary);
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
  background: var(--color-primary);
  color: #ffffff;
  cursor: pointer;
  transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.login-card__button:hover:not(:disabled) {
  background: var(--color-primary-strong);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(52, 110, 245, 0.24);
}

.login-card__button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 900px) {
  .login-page {
    padding: 8px;
    grid-template-columns: 1fr;
  }

  .login-page__hero {
    min-height: 20rem;
  }
}

/* 移动端隐藏 hero 装饰区，登录/安装才是核心操作 */
@media (max-width: 767px) {
  .login-page__hero {
    display: none;
  }

  .login-page {
    padding: 1rem;
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
