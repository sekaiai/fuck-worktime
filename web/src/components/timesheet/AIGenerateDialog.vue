<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  visible: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'generate', dayCount: number, maxChars: number, description: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const dayCount = ref<number>(5);
const maxChars = ref<number>(200);
const description = ref<string>('');
const isGenerating = ref<boolean>(false);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    dayCount.value = 5;
    maxChars.value = 200;
    description.value = '';
    isGenerating.value = false;
  }
});

const canGenerate = computed(() => {
  return (
    dayCount.value >= 1 &&
    dayCount.value <= 7 &&
    maxChars.value >= 50 &&
    maxChars.value <= 200 &&
    description.value.trim().length > 0 &&
    !isGenerating.value
  );
});

const handleClose = () => {
  emit('update:visible', false);
};

const handleGenerate = () => {
  if (!canGenerate.value) return;
  
  isGenerating.value = true;
  emit('generate', dayCount.value, maxChars.value, description.value.trim());
  
  setTimeout(() => {
    isGenerating.value = false;
    handleClose();
  }, 500);
};

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="visible"
        class="dialog-backdrop"
        @click="handleBackdropClick"
      >
        <div class="dialog-container">
          <header class="dialog-header">
            <h3 class="dialog-title">AI 生成工作内容</h3>
            <button class="close-button" @click="handleClose">
              ×
            </button>
          </header>

          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label">生成天数</label>
              <div class="slider-group">
                <input
                  v-model.number="dayCount"
                  class="slider-input"
                  type="range"
                  min="1"
                  max="7"
                  step="1"
                />
                <span class="slider-value">{{ dayCount }} 天</span>
              </div>
              <p class="form-hint">选择需要生成工作内容的天数（1-7天）</p>
            </div>

            <div class="form-group">
              <label class="form-label">最大字数</label>
              <div class="slider-group">
                <input
                  v-model.number="maxChars"
                  class="slider-input"
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                />
                <span class="slider-value">{{ maxChars }} 字</span>
              </div>
              <p class="form-hint">每条工作内容的最大字数（50-200字）</p>
            </div>

            <div class="form-group">
              <label class="form-label">工作内容描述</label>
              <textarea
                v-model="description"
                class="description-input"
                rows="4"
                placeholder="请描述您的工作内容，AI 将根据描述生成具体的工作内容..."
              />
              <p class="form-hint">例如：开发用户管理模块，包括登录、注册、权限管理等功能</p>
            </div>
          </div>

          <footer class="dialog-footer">
            <button class="cancel-button" @click="handleClose">
              取消
            </button>
            <button
              class="generate-button"
              :disabled="!canGenerate"
              @click="handleGenerate"
            >
              {{ isGenerating ? '生成中...' : '生成' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 54, 47, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.dialog-container {
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid rgba(20, 88, 72, 0.14);
  border-radius: 1.5rem;
  background:
    radial-gradient(circle at top right, rgba(255, 224, 191, 0.72), transparent 32%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.98), rgba(237, 245, 241, 0.96));
  box-shadow: 0 24px 48px rgba(39, 78, 70, 0.24);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(20, 88, 72, 0.12);
}

.dialog-title {
  margin: 0;
  color: #14362f;
  font-size: 1.25rem;
  font-weight: 700;
}

.close-button {
  border: none;
  background: transparent;
  color: #8a9f98;
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: #163932;
}

.dialog-body {
  padding: 1.5rem;
  display: grid;
  gap: 1.25rem;
}

.form-group {
  display: grid;
  gap: 0.5rem;
}

.form-label {
  color: #21443d;
  font-size: 0.88rem;
  font-weight: 700;
}

.form-hint {
  margin: 0;
  color: #8a9f98;
  font-size: 0.78rem;
  line-height: 1.5;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider-input {
  flex: 1;
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(20, 88, 72, 0.12);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #145848, #267360);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(20, 88, 72, 0.24);
  transition: transform 0.2s ease;
}

.slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider-value {
  min-width: 3.5rem;
  padding: 0.35rem 0.65rem;
  border-radius: 0.5rem;
  background: rgba(45, 125, 103, 0.12);
  color: #145848;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
}

.description-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  resize: vertical;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.6;
}

.description-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
}

.description-input::placeholder {
  color: #8a9f98;
}

.dialog-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid rgba(20, 88, 72, 0.12);
}

.cancel-button,
.generate-button {
  flex: 1;
  border-radius: 0.85rem;
  padding: 0.82rem 1rem;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  cursor: pointer;
}

.cancel-button {
  border: 1px solid #c9d8d2;
  background: rgba(255, 255, 255, 0.92);
  color: #21443d;
}

.cancel-button:hover {
  transform: translateY(-1px);
  background: rgba(247, 251, 249, 0.95);
}

.generate-button {
  border: none;
  background: linear-gradient(135deg, #145848, #267360);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(20, 88, 72, 0.16);
}

.generate-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.generate-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.25s ease;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.25s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95) translateY(1rem);
}
</style>
