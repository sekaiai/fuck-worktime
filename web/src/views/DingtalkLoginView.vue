<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getQrcode, pollStatus, getUserByUserId } from '../api/dingtalk';
import { setGzdataToken } from '../api/timesheet';
import { setLocalStorage } from '../utils/cache';

const router = useRouter();

const qrcodeBase64 = ref<string | null>(null);
const taskId = ref<string | null>(null);
const status = ref<'idle' | 'loading' | 'waiting' | 'success' | 'timeout' | 'error'>('idle');
const errorMessage = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchQrcode() {
  status.value = 'loading';
  errorMessage.value = null;
  qrcodeBase64.value = null;

  try {
    const result = await getQrcode();
    if (result.taskId && result.qrcode) {
      taskId.value = result.taskId;
      qrcodeBase64.value = result.qrcode;
      status.value = 'waiting';
      startPolling();
    } else {
      status.value = 'error';
      errorMessage.value = '获取二维码失败';
    }
  } catch (error) {
    status.value = 'error';
    errorMessage.value = error instanceof Error ? error.message : '网络错误';
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!taskId.value) return;

    try {
      const result = await pollStatus(taskId.value);

      if (result.status === 'success' && result.userId) {
        status.value = 'success';
        stopPolling();
        await handleLoginSuccess(result.userId);
      } else if (result.status === 'timeout') {
        status.value = 'timeout';
        stopPolling();
      } else if (result.status === 'error') {
        status.value = 'error';
        errorMessage.value = '登录失败';
        stopPolling();
      }
    } catch {
      // continue polling on network error
    }
  }, 2000);
}

async function handleLoginSuccess(userId: string) {
  try {
    const userResult = await getUserByUserId(userId);
    if (userResult.code === 200 && userResult.data) {
      setLocalStorage('userId', userId);
      if (userResult.data.token) {
        setGzdataToken(userResult.data.token);
      }
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      status.value = 'error';
      errorMessage.value = '获取用户信息失败，请重试';
    }
  } catch {
    status.value = 'error';
    errorMessage.value = '获取用户信息失败，请重试';
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function refreshQrcode() {
  stopPolling();
  fetchQrcode();
}

onMounted(() => {
  fetchQrcode();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="dingtalk-login">
    <div class="dingtalk-login__card">
      <h2 class="dingtalk-login__title">钉钉扫码登录</h2>
      <p class="dingtalk-login__subtitle">请使用钉钉扫描下方二维码登录工时管理系统</p>

      <div class="dingtalk-login__qrcode-wrapper">
        <div v-if="status === 'loading'" class="dingtalk-login__loading">
          <div class="spinner"></div>
          <p>正在获取二维码...</p>
        </div>

        <div v-else-if="qrcodeBase64 && (status === 'waiting' || status === 'success')" class="dingtalk-login__qrcode">
          <img :src="'data:image/png;base64,' + qrcodeBase64" alt="钉钉登录二维码" />
          <div v-if="status === 'success'" class="dingtalk-login__overlay">
            <span class="dingtalk-login__check">✓</span>
            <p>登录成功，正在跳转...</p>
          </div>
        </div>

        <div v-else-if="status === 'timeout'" class="dingtalk-login__expired">
          <p>二维码已过期</p>
          <nut-button type="primary" size="small" @click="refreshQrcode">刷新二维码</nut-button>
        </div>

        <div v-else-if="status === 'error'" class="dingtalk-login__error">
          <p>{{ errorMessage || '获取二维码失败' }}</p>
          <nut-button type="primary" size="small" @click="refreshQrcode">重试</nut-button>
        </div>
      </div>

      <div class="dingtalk-login__tips">
        <p>1. 打开手机钉钉</p>
        <p>2. 点击"扫一扫"</p>
        <p>3. 扫描上方二维码</p>
        <p>4. 在手机上确认登录</p>
      </div>

      <router-link to="/" class="dingtalk-login__back">返回首页</router-link>
    </div>
  </div>
</template>

<style scoped>
.dingtalk-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: linear-gradient(135deg, #0f3d3e 0%, #1a5c5e 100%);
}

.dingtalk-login__card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.dingtalk-login__title {
  font-size: 1.5rem;
  color: #1a1a2e;
  margin: 0 0 0.5rem;
}

.dingtalk-login__subtitle {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
}

.dingtalk-login__qrcode-wrapper {
  width: 260px;
  height: 260px;
  margin: 0 auto 1.5rem;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.dingtalk-login__qrcode img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dingtalk-login__overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.dingtalk-login__check {
  font-size: 3rem;
  color: #52c41a;
}

.dingtalk-login__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e8e8e8;
  border-top-color: #0f3d3e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dingtalk-login__expired,
.dingtalk-login__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dingtalk-login__expired p {
  color: #999;
}

.dingtalk-login__error p {
  color: #ff4d4f;
}

.dingtalk-login__tips {
  text-align: left;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.dingtalk-login__tips p {
  margin: 0.3rem 0;
  font-size: 0.85rem;
  color: #666;
}

.dingtalk-login__back {
  color: #0f3d3e;
  text-decoration: none;
  font-size: 0.9rem;
}

.dingtalk-login__back:hover {
  text-decoration: underline;
}
</style>
