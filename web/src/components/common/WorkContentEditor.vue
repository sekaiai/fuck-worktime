<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
  label?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入工作内容描述',
  rows: 4,
  maxLength: 1000,
  showCharCount: true,
  label: '',
  loading: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'generate': [];
}>();

const charCount = computed(() => props.modelValue.length);
const isNearLimit = computed(() => charCount.value > props.maxLength * 0.9);
const isOverLimit = computed(() => charCount.value > props.maxLength);

function updateValue(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  const value = target.value;

  if (value.length <= props.maxLength) {
    emit('update:modelValue', value);
  } else {
    emit('update:modelValue', value.slice(0, props.maxLength));
  }
}
</script>

<template>
  <div class="work-content-editor">
    <div v-if="label" class="work-content-editor__label">{{ label }}</div>

    <div class="work-content-editor__field">
      <label>
        <span>工作内容描述</span>
        <textarea
          :value="modelValue"
          :rows="rows"
          :placeholder="placeholder"
          :class="{ 'is-over-limit': isOverLimit }"
          @input="updateValue"
        />
      </label>

      <div v-if="showCharCount" class="work-content-editor__counter" :class="{ 'is-warning': isNearLimit, 'is-error': isOverLimit }">
        <span>{{ charCount }}</span>
        <span class="work-content-editor__counter-divider">/</span>
        <span>{{ maxLength }}</span>
      </div>
    </div>

    <div class="work-content-editor__actions">
      <button
        class="work-content-editor__generate"
        type="button"
        :disabled="loading || !modelValue.trim()"
        @click="emit('generate')"
      >
        {{ loading ? '生成中...' : '✨ AI 生成描述' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.work-content-editor {
  display: grid;
  gap: 0.8rem;
}

.work-content-editor__label {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.work-content-editor__field {
  position: relative;
  display: grid;
  gap: 0.4rem;
}

.work-content-editor__field label {
  display: grid;
  gap: 0.35rem;
}

.work-content-editor__field span {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.work-content-editor__field textarea {
  width: 100%;
  border: 1px solid rgba(19, 38, 40, 0.14);
  border-radius: 18px;
  padding: 0.86rem 0.95rem;
  background: rgba(255, 255, 255, 0.72);
  font-size: 1rem;
  font-family: var(--font-body);
  line-height: 1.6;
  resize: vertical;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.work-content-editor__field textarea:focus {
  outline: none;
  border-color: rgba(35, 76, 75, 0.34);
  box-shadow: 0 0 0 3px rgba(35, 76, 75, 0.08);
}

.work-content-editor__field textarea.is-over-limit {
  border-color: var(--danger);
}

.work-content-editor__counter {
  position: absolute;
  right: 0.95rem;
  bottom: 0.85rem;
  font-family: var(--font-display);
  font-size: 0.76rem;
  color: var(--ink-muted);
  pointer-events: none;
}

.work-content-editor__counter.is-warning {
  color: var(--accent-amber);
}

.work-content-editor__counter.is-error {
  color: var(--danger);
  font-weight: 600;
}

.work-content-editor__counter-divider {
  margin: 0 0.1rem;
}

.work-content-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.work-content-editor__generate {
  border: 0;
  border-radius: 999px;
  min-height: 2.9rem;
  padding: 0.72rem 1.2rem;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
  font-family: var(--font-display);
  font-size: 0.88rem;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.work-content-editor__generate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(17, 43, 46, 0.16);
}

.work-content-editor__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
