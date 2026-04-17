<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getQrcode, pollStatus } from '../api/dingtalk-client';
import { useAuthSession } from '../composables/useAuthSession';

const router = useRouter();
const route = useRoute();
const auth = useAuthSession();

const qrcode = shallowRef('');
const taskId = shallowRef('');
const status = shallowRef<'loading' | 'waiting' | 'success' | 'timeout' | 'error'>('loading');
const loginState = shallowRef<'qrcode' | 'auto_login'>('qrcode');
const message = shallowRef('');
let pollTimer: number | null = null;

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
        auth.storeUserId(result.userId);
        const ok = await auth.hydrateUser(result.userId);
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
    <section class="login-card">
      <p class="login-eyebrow">钉钉登录</p>
      <h1 class="login-title">钉钉扫码登录</h1>
      <p class="login-copy">
        {{ route.query.reason === 'expired' ? '当前 token 已失效，请重新完成钉钉登录。' : '首次进入请使用钉钉扫码登录。' }}
      </p>

      <div class="login-qrcode">
        <div v-if="status === 'loading'" class="login-state">正在获取二维码...</div>
        <img v-else-if="qrcode" :src="`data:image/png;base64,${qrcode}`" alt="钉钉登录二维码" />
        <div v-else-if="loginState === 'auto_login' && status === 'waiting'" class="login-state">
          检测到已登录状态，正在自动完成授权...
        </div>
        <div v-else class="login-state">{{ message || '二维码暂不可用。' }}</div>
      </div>

      <div v-if="status === 'waiting'" class="login-note">
        {{ loginState === 'auto_login' ? '正在复用已保存的钉钉登录状态，成功后会自动跳转。' : '请使用钉钉扫一扫完成授权，系统会在成功后自动跳转。' }}
      </div>
      <div v-else-if="status === 'success'" class="login-note">登录成功，正在恢复用户数据...</div>
      <div v-else-if="status === 'timeout' || status === 'error'" class="login-error">{{ message }}</div>

      <button class="login-button" type="button" @click="loadQrcode">
        {{ status === 'loading' ? '处理中...' : '刷新二维码' }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.login-card {
  width: min(100%, 420px);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 28px;
  padding: 1.4rem;
  box-shadow: 0 28px 60px rgba(15, 61, 62, 0.12);
  text-align: center;
}

.login-eyebrow {
  margin: 0;
  color: #7c6c54;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.76rem;
}

.login-title {
  margin: 0.35rem 0 0;
}

.login-copy {
  margin: 0.7rem 0 0;
  color: #5f645b;
}

.login-qrcode {
  margin: 1.2rem auto 1rem;
  width: min(100%, 280px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: #f5f1e8;
  overflow: hidden;
}

.login-qrcode img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-state,
.login-note,
.login-error {
  color: #5f645b;
}

.login-error {
  color: #b42318;
}

.login-button {
  margin-top: 1rem;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 0.95rem 1rem;
  background: #0f4f53;
  color: #fff;
  cursor: pointer;
}
</style>
