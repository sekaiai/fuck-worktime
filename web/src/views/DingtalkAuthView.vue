<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { getQrcode, pollStatus } from '../api/dingtalk-client';
import { usePwaDetect } from '../composables/usePwaDetect';
import { useAuthStore } from '../stores/auth';

type LoginStatus = 'loading' | 'waiting' | 'success' | 'timeout' | 'error';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isLoading } = storeToRefs(authStore);
const { isPwa } = usePwaDetect();

const qrcode = shallowRef('');
const taskId = shallowRef('');
const phone = shallowRef('');
const status = shallowRef<LoginStatus>('loading');
const loginState = shallowRef<'qrcode' | 'auto_login'>('qrcode');
const message = shallowRef('');
const isMobileDevice = shallowRef(false);
let pollTimer: number | null = null;

const showInstallGuide = computed(() => isMobileDevice.value && !isPwa.value);
const isPhoneLoginMode = computed(() => isPwa.value);
const showHeroEyebrow = computed(() => !isPhoneLoginMode.value);

const heroTitle = computed(() => {
  if (showInstallGuide.value) {
    return '先安装应用';
  }

  return route.query.reason === 'expired'
    ? '会话已失效，请重新校验身份。'
    : '进入工时控制台前，先完成一次身份校验。';
});

const heroCopy = computed(() => {
  if (showInstallGuide.value) {
    return '手机浏览器里不能直接登录。先安装到桌面，再从应用进入。';
  }

  if (isPhoneLoginMode.value) {
    return 'PWA 端默认通过手机号恢复已保存的登录数据，不再展示扫码流程。';
  }

  return loginState.value === 'auto_login'
    ? '系统正在尝试复用已保存的钉钉授权，成功后会自动恢复用户资料并跳转。'
    : '使用钉钉扫码后，系统会自动换取 gzdata token，并恢复你本周的填报数据。';
});

const accessModeLabel = computed(() => {
  if (showInstallGuide.value) {
    return '安装 PWA';
  }
  return isPhoneLoginMode.value ? '手机号恢复' : '钉钉扫码授权';
});

const cardTitle = computed(() => {
  if (showInstallGuide.value) {
    return '安装指引';
  }
  return isPhoneLoginMode.value ? '手机号登录' : '扫码登录';
});

const statusLabel = computed(() => {
  if (showInstallGuide.value) {
    return '';
  }
  if (status.value === 'loading') {
    return isPhoneLoginMode.value ? '待输入' : '准备中';
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
  if (showInstallGuide.value) {
    return '安装后从桌面图标打开，再用手机号登录。';
  }

  if (isLoading.value || status.value === 'success') {
    return '登录成功，正在恢复用户信息。';
  }

  if (isPhoneLoginMode.value) {
    if (status.value === 'error') {
      return message.value || '请输入手机号后重试。';
    }
    return '请输入你在 gzdata 中绑定的手机号，系统会直接恢复已保存的登录数据。';
  }

  if (status.value === 'waiting') {
    return loginState.value === 'auto_login'
      ? '系统正在复用钉钉登录状态，授权成功后会自动跳转。'
      : '请使用钉钉扫码完成授权，成功后会自动恢复数据。';
  }

  return message.value || '如页面停滞，可手动刷新二维码重试。';
});

function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const mobileUserAgent = /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent);
  const smallScreen = window.matchMedia('(max-width: 768px)').matches;
  return mobileUserAgent || smallScreen;
}

function clearTimer(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function finishLogin(targetUserId: string): Promise<void> {
  authStore.storeUserId(targetUserId);
  const ok = await authStore.hydrateUser(targetUserId);
  if (ok) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
    return;
  }

  status.value = 'error';
  message.value = '获取用户信息失败，请重新登录。';
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
      message.value = error instanceof Error ? error.message : '查询登录状态失败。';
      clearTimer();
    }
  }, 2000);
}

async function loadQrcode(): Promise<void> {
  if (showInstallGuide.value || isPhoneLoginMode.value) {
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
    message.value = error instanceof Error ? error.message : '获取二维码失败。';
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

  const ok = await authStore.hydrateUserByPhone(normalizedPhone);
  if (!ok) {
    status.value = 'error';
    message.value = '未找到该手机号的登录数据，请先在网页上扫码登录。';
    return;
  }

  status.value = 'success';
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await router.replace(redirect);
}

onMounted(() => {
  isMobileDevice.value = detectMobileDevice();
  void loadQrcode();
});

onUnmounted(() => {
  clearTimer();
});
</script>

<template>
  <main class="login-page">
    <section class="login-page__hero">
      <p v-if="showHeroEyebrow" class="login-page__eyebrow">DingTalk Gateway</p>
      <h1 class="login-page__title">{{ heroTitle }}</h1>
      <p class="login-page__copy">{{ heroCopy }}</p>

    </section>

    <section class="login-card">
      <div class="login-card__header">
        <div>
          <p class="login-card__eyebrow">Identity Checkpoint</p>
          <h2 class="login-card__title">{{ cardTitle }}</h2>
        </div>
        <span class="login-card__badge" :class="`is-${status}`" v-if="statusLabel">{{ statusLabel }}</span>
      </div>

      <div v-if="showInstallGuide" class="install-guide">
        <div class="install-guide__steps">
          <article class="install-guide__step">
            <strong>1.浏览器菜单</strong>
            <p>打开右上或底部分享按钮。</p>
          </article>
          <article class="install-guide__step">
            <strong>2.添加到桌面</strong>
            <p>选择“安装应用”或“添加到主屏幕”。</p>
          </article>
          <article class="install-guide__step">
            <strong>3.从桌面打开</strong>
            <p>回到应用内再登录。</p>
          </article>
        </div>
      </div>

      <div v-else-if="isPhoneLoginMode" class="login-card__form">
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
          {{ isLoading ? '登录中...' : '手机号登录' }}
        </button>
      </div>

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
        v-if="!showInstallGuide && !isPhoneLoginMode"
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
  padding: clamp(1rem, 3vw, 2rem);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 420px);
  gap: 1.2rem;
  align-items: stretch;
          box-sizing: border-box;
}

.login-page__hero,
.login-card {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  padding: clamp(1.2rem, 2.5vw, 2rem);
  background: linear-gradient(180deg, rgba(255, 251, 245, 0.82), rgba(240, 233, 224, 0.7));
  box-shadow: 0 28px 60px rgba(20, 41, 44, 0.12);
  backdrop-filter: blur(16px);
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

.install-guide {
  display: grid;
  gap: 0.9rem;
}

.install-guide__steps {
  display: grid;
  gap: 0.8rem;
}

.install-guide__step {
  display: grid;
  gap: 0.45rem;
  padding: 1rem;
  border-radius: 22px;
  background-color: #efe8db;
}

.install-guide__step strong {
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
}

.install-guide__step p {
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.65;
}

.login-card__form {
  display: grid;
  gap: 0.9rem;
}

.login-card__field {
  display: grid;
  gap: 0.55rem;
  color: var(--ink-soft);
}

.login-card__input {
  width: 100%;
  min-height: 3.2rem;
  border-radius: 18px;
  padding: 0.85rem 1rem;
  background: rgba(255, 255, 255, 0.78);
  color: var(--ink);
  font: inherit;
}

.login-card__input:focus {
  outline: 2px solid rgba(201, 137, 56, 0.25);
  outline-offset: 1px;
}

.login-card__frame {
  width: min(100%, 310px);
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(233, 227, 218, 0.76));
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

.login-card__button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 24px rgba(15, 44, 47, 0.18);
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

  .login-page__hero,
  .login-card {
    min-height: auto;
    box-shadow: none;
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
