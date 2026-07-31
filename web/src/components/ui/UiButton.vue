<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    block?: boolean;
  }>(),
  { variant: 'primary', size: 'md', loading: false, block: false },
);
</script>

<template>
  <button
    type="button"
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'ui-btn--block': block }]"
    :disabled="loading || $attrs.disabled"
  >
    <span v-if="loading" class="ui-btn__spinner"></span>
    <slot />
  </button>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 0;
  border-radius: 999px;
  font-family: var(--font-display);
  font-weight: 500;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, background-color 160ms ease;
}
.ui-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ui-btn:disabled { cursor: not-allowed; opacity: 0.55; }
.ui-btn--sm { min-height: 2.3rem; padding: 0.5rem 0.9rem; font-size: 0.84rem; }
.ui-btn--md { min-height: 3rem; padding: 0.8rem 1.1rem; font-size: 0.92rem; }
.ui-btn--lg { min-height: 3.4rem; padding: 0.9rem 1.3rem; font-size: 1rem; }
.ui-btn--block { width: 100%; }
.ui-btn--primary { background: var(--color-primary); color: #fff; box-shadow: 0 12px 24px rgba(52, 110, 245, 0.24); }
.ui-btn--primary:hover:not(:disabled) { background: var(--color-primary-strong); }
.ui-btn--secondary { background: var(--color-bg-soft); color: var(--color-text-primary); }
.ui-btn--ghost { background: transparent; color: var(--color-primary); }
.ui-btn--danger { background: rgba(220, 76, 66, 0.1); color: var(--color-danger); }
.ui-btn__spinner {
  width: 0.95em; height: 0.95em;
  border: 2px solid currentColor; border-top-color: transparent;
  border-radius: 50%; animation: ui-btn-spin 0.7s linear infinite;
}
@keyframes ui-btn-spin { to { transform: rotate(360deg); } }
</style>
