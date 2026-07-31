<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  message: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
      <p class="modal-card__eyebrow">System Message</p>
      <h3 class="modal-card__title">{{ title }}</h3>
      <p class="modal-card__copy">{{ message }}</p>
      <button class="modal-card__button" type="button" @click="emit('close')">知道了</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(12px);
}

.modal-card {
  width: min(100%, 460px);
  border-radius: 28px;
  padding: 1.4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-float);
}

.modal-card__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.modal-card__title {
  font-size: 1.6rem;
}

.modal-card__copy {
  margin-top: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.75;
}

.modal-card__button {
  width: 100%;
  margin-top: 1rem;
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
}

.modal-card__button:hover {
  background: var(--color-primary-strong);
}
</style>
