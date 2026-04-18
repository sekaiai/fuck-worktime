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
  background: rgba(10, 23, 25, 0.52);
  backdrop-filter: blur(12px);
}

.modal-card {
  width: min(100%, 460px);
  border-radius: 28px;
  padding: 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 251, 244, 0.9), rgba(239, 233, 225, 0.82));
  box-shadow: 0 28px 60px rgba(10, 23, 25, 0.28);
}

.modal-card__eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent-amber);
  font-family: var(--font-display);
  font-size: 0.76rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.modal-card__title {
  font-size: 1.6rem;
}

.modal-card__copy {
  margin-top: 0.8rem;
  color: var(--ink-soft);
  line-height: 1.75;
}

.modal-card__button {
  width: 100%;
  margin-top: 1rem;
  border: 0;
  border-radius: 999px;
  min-height: 3rem;
  padding: 0.82rem 1rem;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: rgba(255, 248, 238, 0.94);
}
</style>
