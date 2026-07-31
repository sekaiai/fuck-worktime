<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div v-if="message" class="toast">
    <span class="toast__mark">!</span>
    <span>{{ message }}</span>
  </div>
</template>

<style scoped>
.toast {
  position: sticky;
  bottom: 0.75rem;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.9rem;
  padding: 0.78rem 0.95rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
}

.toast__mark {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: rgba(52, 110, 245, 0.28);
  color: #dbe7ff;
  font-family: var(--font-display);
}
</style>
