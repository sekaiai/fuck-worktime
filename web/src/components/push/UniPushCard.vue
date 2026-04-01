<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  isConfigured: boolean;
  isLoading: boolean;
  statusMessage: string;
  cid: string;
  registrationCount: number;
}>();

const emit = defineEmits<{
  register: [cid: string, platform: 'android' | 'ios' | 'web'];
  unregister: [cid: string];
  sendMessage: [title: string, content: string, payload?: Record<string, unknown>, cids?: string[]];
}>();

const platformOptions = [
  { label: 'Android', value: 'android' },
  { label: 'iOS', value: 'ios' },
  { label: 'Web', value: 'web' },
] as const;

const selectedPlatform = ref<'android' | 'ios' | 'web'>('web');
const cidInput = ref('');
const titleInput = ref('测试通知');
const contentInput = ref('这是一条测试推送消息');

function handleRegister() {
  if (cidInput.value) {
    emit('register', cidInput.value, selectedPlatform.value);
  }
}

function handleUnregister() {
  if (props.cid) {
    emit('unregister', props.cid);
  }
}

function handleSendMessage() {
  emit('sendMessage', titleInput.value, contentInput.value);
}
</script>

<template>
  <section class="card">
    <header class="card-header">
      <div>
        <p class="card-kicker">推送控制台</p>
        <h2 class="card-title">Uni-Push 推送服务</h2>
      </div>
      <span class="pill" :class="{ 'pill-live': isConfigured }">
        {{ isConfigured ? '已配置' : '未配置' }}
      </span>
    </header>

    <dl class="status-grid">
      <div class="status-item">
        <dt class="status-label">服务状态</dt>
        <dd class="status-value">{{ isConfigured ? '正常' : '未配置' }}</dd>
      </div>
      <div class="status-item">
        <dt class="status-label">已注册设备</dt>
        <dd class="status-value">{{ registrationCount }}</dd>
      </div>
    </dl>

    <p class="status-copy">{{ props.statusMessage }}</p>

    <div v-if="!isConfigured" class="config-warning">
      <p class="warning-title">⚠️ Uni-Push 未配置</p>
      <p class="warning-text">
        请在后端配置 UNI_PUSH_APP_ID、UNI_PUSH_APP_KEY、UNI_PUSH_MASTER_SECRET 环境变量。
      </p>
    </div>

    <div class="section-title">设备注册</div>
    
    <div class="cid-info">
      <p class="info-title">📌 CID 是什么？</p>
      <p class="info-text">
        CID (Client ID) 是设备的唯一标识符，用于指定推送目标。
      </p>
      <div class="info-table">
        <div class="info-row">
          <span class="info-label">uni-app 应用</span>
          <span class="info-value">使用 <code>uni.getPushClientId()</code> 获取</span>
        </div>
        <div class="info-row">
          <span class="info-label">Web 应用</span>
          <span class="info-value">需要集成个推 Web SDK</span>
        </div>
      </div>
    </div>

    <div class="form-row">
      <input
        v-model="cidInput"
        type="text"
        class="input"
        placeholder="输入设备 CID (Client ID)"
      />
      <select v-model="selectedPlatform" class="select">
        <option v-for="opt in platformOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <div class="actions">
      <button
        class="button button-primary"
        type="button"
        :disabled="!cidInput || isLoading"
        @click="handleRegister"
      >
        {{ isLoading ? '处理中...' : '注册设备' }}
      </button>
      <button
        v-if="cid"
        class="button button-secondary"
        type="button"
        :disabled="isLoading"
        @click="handleUnregister"
      >
        注销设备
      </button>
    </div>

    <div class="section-title">发送推送</div>
    <div class="form-row">
      <input
        v-model="titleInput"
        type="text"
        class="input"
        placeholder="通知标题"
      />
    </div>
    <div class="form-row">
      <input
        v-model="contentInput"
        type="text"
        class="input"
        placeholder="通知内容"
      />
    </div>
    <div class="actions">
      <button
        class="button button-primary"
        type="button"
        :disabled="!isConfigured || isLoading"
        @click="handleSendMessage"
      >
        {{ isLoading ? '发送中...' : '发送推送' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.card {
  max-width: 720px;
  padding: 1.5rem;
  border: 1px solid rgba(15, 61, 62, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgba(15, 61, 62, 0.12);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.card-kicker {
  margin: 0 0 0.35rem;
  color: #7d5c2f;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.card-title {
  margin: 0;
  font-size: 1.6rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  background: #e5e4df;
  color: #445b5d;
  font-size: 0.85rem;
  font-weight: 700;
}

.pill-live {
  background: #0f3d3e;
  color: #f7f3ea;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0 1rem;
}

.status-item {
  margin: 0;
  padding: 1rem;
  border-radius: 20px;
  background: #f7f3ea;
}

.status-label {
  color: #6b7879;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-value {
  margin: 0.4rem 0 0;
  color: #0d2324;
  font-size: 1.05rem;
  font-weight: 700;
}

.status-copy {
  margin: 0 0 1.25rem;
  color: #355254;
  line-height: 1.7;
}

.config-warning {
  margin: 0 0 1.25rem;
  padding: 1rem;
  border-radius: 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
}

.warning-title {
  margin: 0 0 0.5rem;
  color: #856404;
  font-weight: 700;
}

.warning-text {
  margin: 0;
  color: #856404;
  font-size: 0.9rem;
  line-height: 1.6;
}

.section-title {
  margin: 1rem 0 0.5rem;
  color: #0f3d3e;
  font-size: 0.9rem;
  font-weight: 600;
}

.cid-info {
  margin: 0 0 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: #e8f4f4;
  border: 1px solid #0f3d3e;
}

.info-title {
  margin: 0 0 0.5rem;
  color: #0f3d3e;
  font-weight: 700;
}

.info-text {
  margin: 0 0 0.75rem;
  color: #355254;
  font-size: 0.85rem;
  line-height: 1.6;
}

.info-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
}

.info-label {
  color: #0f3d3e;
  font-weight: 600;
  font-size: 0.85rem;
}

.info-value {
  color: #355254;
  font-size: 0.85rem;
}

.info-value code {
  padding: 0.2rem 0.4rem;
  background: #f0f0f0;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.input {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.9rem;
}

.select {
  padding: 0.6rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.4rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 180ms ease, opacity 180ms ease;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.button-primary {
  background: #0f3d3e;
  color: #f7f3ea;
}

.button-secondary {
  background: #e6ddd0;
  color: #1f3536;
}

@media (max-width: 640px) {
  .status-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
