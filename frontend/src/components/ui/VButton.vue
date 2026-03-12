<script setup>
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false }
})

defineEmits(['click'])
</script>

<template>
  <button
    class="v-btn"
    :class="[
      `v-btn--${variant}`,
      `v-btn--${size}`,
      { 'v-btn--block': block, 'v-btn--loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="v-btn__spinner" />
    <span class="v-btn__content" :class="{ 'v-btn__content--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.v-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  position: relative;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.v-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.v-btn--sm { height: 32px; padding: 0 12px; font-size: 13px; }
.v-btn--md { height: 36px; padding: 0 16px; font-size: 14px; }
.v-btn--lg { height: 40px; padding: 0 20px; font-size: 14px; }

.v-btn--primary {
  background: var(--text-primary);
  color: var(--bg-primary);
}
.v-btn--primary:hover:not(:disabled) {
  background: var(--gray-300);
}

.v-btn--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.v-btn--secondary:hover:not(:disabled) {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.v-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.v-btn--ghost:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-btn--danger {
  background: var(--accent-red);
  color: #fff;
}
.v-btn--danger:hover:not(:disabled) {
  background: var(--accent-red-hover);
}

.v-btn--block { width: 100%; }

.v-btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.v-btn__content--hidden { visibility: hidden; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
