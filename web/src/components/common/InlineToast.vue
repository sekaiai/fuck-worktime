<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div v-if="message" class="toast">{{ message }}</div>
</template>

<style scoped>
.toast {
  position: sticky;
  bottom: 0.75rem;
  margin-top: 0.75rem;
  border-radius: 14px;
  padding: 0.7rem 0.9rem;
  background: rgba(19, 39, 44, 0.92);
  color: #fff;
  font-size: 0.88rem;
  z-index: 20;
}
</style>
