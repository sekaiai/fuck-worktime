<script setup lang="ts">
import type { AuthorizedUserProfile } from '../../api/user';
import { onMounted, ref } from 'vue';

import { getGzdataToken, getProjects, setGzdataToken } from '../../api/timesheet';

import HomeTokenHelp from './HomeTokenHelp.vue';

interface Props {
  token: string;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  statusMessage: string;
  authorizedUser: AuthorizedUserProfile | null;
}

interface Emits {
  (event: 'update:token', value: string): void;
  (event: 'submit'): void;
  (event: 'clear-auth'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const gzdataTokenInput = ref<string>('');
const gzdataTokenStatus = ref<'idle' | 'saved' | 'verifying' | 'valid' | 'invalid'>('idle');
const gzdataTokenMessage = ref<string>('');

onMounted(() => {
  const savedToken = getGzdataToken();
  if (savedToken) {
    gzdataTokenInput.value = savedToken;
    gzdataTokenStatus.value = 'saved';
    gzdataTokenMessage.value = 'Token 已保存';
  }
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:token', target.value);
};

const handleGzdataTokenInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  gzdataTokenInput.value = target.value;
};

const saveGzdataToken = () => {
  if (!gzdataTokenInput.value.trim()) {
    gzdataTokenStatus.value = 'invalid';
    gzdataTokenMessage.value = 'Token 不能为空';
    return;
  }
  
  setGzdataToken(gzdataTokenInput.value.trim());
  gzdataTokenStatus.value = 'saved';
  gzdataTokenMessage.value = 'Token 已保存到本地存储';
};

const verifyGzdataToken = async () => {
  if (!gzdataTokenInput.value.trim()) {
    gzdataTokenStatus.value = 'invalid';
    gzdataTokenMessage.value = 'Token 不能为空';
    return;
  }
  
  gzdataTokenStatus.value = 'verifying';
  gzdataTokenMessage.value = '正在验证 Token...';
  
  try {
    const savedToken = getGzdataToken();
    if (!savedToken || savedToken !== gzdataTokenInput.value.trim()) {
      setGzdataToken(gzdataTokenInput.value.trim());
    }
    
    await getProjects();
    gzdataTokenStatus.value = 'valid';
    gzdataTokenMessage.value = 'Token 验证成功，可以正常访问项目列表';
  } catch (error) {
    gzdataTokenStatus.value = 'invalid';
    gzdataTokenMessage.value = `Token 验证失败: ${error instanceof Error ? error.message : '未知错误'}`;
  }
};

const submit = () => {
  if (props.isSubmitting) {
    return;
  }

  emit('submit');
};

const statusClassMap = {
  idle: 'status-card-idle',
  success: 'status-card-success',
  error: 'status-card-error',
} as const;
</script>

<template>
  <section class="token-card" aria-label="授权 Token 录入">
    <header class="token-head">
      <div>
        <p class="token-eyebrow">Authorization</p>
        <h2 class="token-title">填写授权 Token</h2>
      </div>
      <p class="token-note">
        请粘贴登录后获取到的 Token，不需要带 Bearer 前缀。
      </p>
    </header>

    <label v-if="!authorizedUser" class="token-input-wrap">
      <span class="token-label">授权 Token</span>
      <input
        :value="token"
        class="token-input"
        type="text"
        placeholder="请输入授权 Token"
        autocomplete="off"
        @input="handleInput"
      />
    </label>

    <div v-if="!authorizedUser" class="token-actions">
      <button class="primary-button" :disabled="isSubmitting" @click="submit">
        {{ isSubmitting ? '授权中...' : '保存授权并获取用户信息' }}
      </button>
    </div>

    <div :class="['status-card', statusClassMap[submitStatus]]">
      <p class="status-title">
        {{ submitStatus === 'success' ? '授权状态' : submitStatus === 'error' ? '授权失败' : '操作提示' }}
      </p>
      <p class="status-text">{{ statusMessage }}</p>
    </div>

    <section v-if="authorizedUser" class="user-panel" aria-label="已保存用户信息">
      <div class="user-head">
        <p class="user-label">已授权用户</p>
        <span
          :class="[
            'user-status',
            authorizedUser.status === 'expired' ? 'user-status-expired' : 'user-status-active',
          ]"
        >
          {{ authorizedUser.status === 'expired' ? '授权已过期' : '授权有效' }}
        </span>
      </div>
      <div class="user-grid">
        <article class="user-item">
          <span>昵称</span>
          <strong>{{ authorizedUser.nickname }}</strong>
        </article>
        <article class="user-item">
          <span>手机号</span>
          <strong>{{ authorizedUser.phone }}</strong>
        </article>
      </div>

      <button class="danger-button" :disabled="isSubmitting" @click="$emit('clear-auth')">
        {{ isSubmitting ? '处理中...' : '清除授权' }}
      </button>
    </section>

    <section class="gzdata-token-panel" aria-label="Gzdata Token 管理">
      <header class="gzdata-head">
        <div>
          <p class="gzdata-eyebrow">Gzdata API</p>
          <h3 class="gzdata-title">Gzdata Token 配置</h3>
        </div>
        <p class="gzdata-note">
          请输入 gzdata 系统的 Token，用于访问工时填报相关接口。
        </p>
      </header>

      <label class="gzdata-input-wrap">
        <span class="gzdata-label">Gzdata Token</span>
        <input
          v-model="gzdataTokenInput"
          class="gzdata-input"
          type="text"
          placeholder="请输入 Gzdata Token"
          autocomplete="off"
          @input="handleGzdataTokenInput"
        />
      </label>

      <div class="gzdata-actions">
        <button 
          class="secondary-button" 
          :disabled="gzdataTokenStatus === 'verifying' || !gzdataTokenInput.trim()"
          @click="saveGzdataToken"
        >
          保存 Token
        </button>
        <button 
          class="primary-button" 
          :disabled="gzdataTokenStatus === 'verifying' || !gzdataTokenInput.trim()"
          @click="verifyGzdataToken"
        >
          {{ gzdataTokenStatus === 'verifying' ? '验证中...' : '验证 Token' }}
        </button>
      </div>

      <div 
        v-if="gzdataTokenMessage" 
        :class="['gzdata-status-card', `gzdata-status-${gzdataTokenStatus}`]"
      >
        <p class="gzdata-status-text">{{ gzdataTokenMessage }}</p>
      </div>
    </section>

    <HomeTokenHelp v-if="!authorizedUser" />
  </section>
</template>

<style scoped>
.token-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(20, 88, 72, 0.14);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at top right, rgba(255, 224, 191, 0.72), transparent 32%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.94), rgba(237, 245, 241, 0.92));
  padding: 1rem;
  box-shadow: 0 20px 40px rgba(39, 78, 70, 0.08);
}

.token-head {
  display: grid;
  gap: 0.4rem;
}

.token-eyebrow {
  margin: 0;
  color: #587169;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.token-title {
  margin: 0;
  color: #14362f;
  font-size: clamp(1.35rem, 3.4vw, 1.9rem);
  line-height: 1.05;
}

.token-note {
  margin: 0;
  max-width: 54ch;
  color: #4c6760;
  font-size: 0.9rem;
  line-height: 1.7;
}

.token-input-wrap {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
}

.token-label {
  color: #21443d;
  font-size: 0.84rem;
  font-weight: 700;
}

.token-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.token-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
  transform: translateY(-1px);
}

.token-actions {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.65rem;
}

.primary-button,
.danger-button {
  border-radius: 0.85rem;
  padding: 0.82rem 1rem;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.primary-button {
  border: none;
  background: linear-gradient(135deg, #145848, #267360);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(20, 88, 72, 0.16);
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.75;
}

.primary-button:not(:disabled):hover,
.danger-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.status-card {
  margin-top: 0.9rem;
  border-radius: 0.95rem;
  padding: 0.85rem 0.95rem;
}

.status-card-idle {
  background: rgba(247, 251, 249, 0.95);
  border: 1px solid #d6e2dd;
}

.status-card-success {
  background: rgba(229, 246, 239, 0.95);
  border: 1px solid #a9d5c2;
}

.status-card-error {
  background: rgba(255, 240, 238, 0.95);
  border: 1px solid #efc2bc;
}

.status-title,
.status-text,
.user-label {
  margin: 0;
}

.status-title {
  color: #173932;
  font-size: 0.82rem;
  font-weight: 700;
}

.status-text {
  margin-top: 0.28rem;
  color: #4c6760;
  font-size: 0.88rem;
  line-height: 1.6;
}

.user-panel {
  margin-top: 0.95rem;
  border: 1px solid rgba(20, 88, 72, 0.12);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.75);
  padding: 0.9rem;
}

.user-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.user-label {
  color: #587169;
  font-size: 0.74rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.user-status {
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 700;
}

.user-status-active {
  background: rgba(229, 246, 239, 0.95);
  color: #1d654f;
}

.user-status-expired {
  background: rgba(255, 240, 238, 0.95);
  color: #a34a3f;
}

.user-grid {
  margin-top: 0.7rem;
  display: grid;
  gap: 0.55rem;
}

.user-item {
  border-radius: 0.85rem;
  background: #f5faf7;
  border: 1px solid #d5e2dc;
  padding: 0.8rem 0.85rem;
}

.user-item span,
.user-item strong {
  display: block;
}

.user-item span {
  color: #5c766f;
  font-size: 0.78rem;
}

.user-item strong {
  margin-top: 0.15rem;
  color: #1c3f37;
  font-size: 0.98rem;
}

.danger-button {
  width: 100%;
  margin-top: 0.8rem;
  border: 1px solid #efc2bc;
  background: rgba(255, 240, 238, 0.95);
  color: #9d4337;
}

.gzdata-token-panel {
  margin-top: 1.2rem;
  border: 1px solid rgba(20, 88, 72, 0.12);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.65);
  padding: 1rem;
}

.gzdata-head {
  display: grid;
  gap: 0.4rem;
}

.gzdata-eyebrow {
  margin: 0;
  color: #587169;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.gzdata-title {
  margin: 0;
  color: #14362f;
  font-size: clamp(1.1rem, 2.8vw, 1.5rem);
  line-height: 1.1;
}

.gzdata-note {
  margin: 0;
  max-width: 54ch;
  color: #4c6760;
  font-size: 0.85rem;
  line-height: 1.6;
}

.gzdata-input-wrap {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
}

.gzdata-label {
  color: #21443d;
  font-size: 0.84rem;
  font-weight: 700;
}

.gzdata-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.gzdata-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
  transform: translateY(-1px);
}

.gzdata-actions {
  margin-top: 0.85rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.secondary-button {
  border-radius: 0.85rem;
  padding: 0.82rem 1rem;
  border: 1px solid #c9d8d2;
  background: rgba(255, 255, 255, 0.92);
  color: #21443d;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.secondary-button:not(:disabled):hover {
  transform: translateY(-1px);
  background: rgba(247, 251, 249, 0.95);
}

.gzdata-status-card {
  margin-top: 0.9rem;
  border-radius: 0.95rem;
  padding: 0.85rem 0.95rem;
}

.gzdata-status-idle {
  background: rgba(247, 251, 249, 0.95);
  border: 1px solid #d6e2dd;
}

.gzdata-status-saved {
  background: rgba(229, 246, 239, 0.95);
  border: 1px solid #a9d5c2;
}

.gzdata-status-verifying {
  background: rgba(255, 250, 240, 0.95);
  border: 1px solid #e5d5b5;
}

.gzdata-status-valid {
  background: rgba(229, 246, 239, 0.95);
  border: 1px solid #a9d5c2;
}

.gzdata-status-invalid {
  background: rgba(255, 240, 238, 0.95);
  border: 1px solid #efc2bc;
}

.gzdata-status-text {
  margin: 0;
  color: #4c6760;
  font-size: 0.88rem;
  line-height: 1.6;
}

@media (min-width: 900px) {
  .token-card {
    padding: 1.15rem;
  }

  .token-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .user-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
