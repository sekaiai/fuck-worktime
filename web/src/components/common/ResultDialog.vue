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
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <button class="primary-button" type="button" @click="emit('close')">知道了</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 35, 40, 0.45);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 40;
}

.modal-card {
  width: min(100%, 420px);
  border-radius: 18px;
  background: #fff;
  padding: 1rem;
}

.primary-button {
  width: 100%;
  margin-top: 0.75rem;
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1rem;
  background: #0f4f53;
  color: #fff;
}
</style>
