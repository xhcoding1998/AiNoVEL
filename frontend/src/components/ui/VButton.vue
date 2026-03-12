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
  letter-spacing: -0.01em;
}

.v-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.v-btn--sm { height: 32px; padding: 0 12px; font-size: 13px; border-radius: var(--radius-sm); }
.v-btn--md { height: 36px; padding: 0 16px; font-size: 13px; }
.v-btn--lg { height: 42px; padding: 0 20px; font-size: 14px; }

.v-btn--primary {
  background: var(--text-primary);
  color: var(--bg-primary);
  font-weight: 600;
}
.v-btn--primary:hover:not(:disabled) {
  background: var(--gray-300);
  transform: translateY(-0.5px);
}
.v-btn--primary:active:not(:disabled) {
  background: var(--gray-400);
  transform: translateY(0);
}

.v-btn--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-hover);
}
.v-btn--secondary:hover:not(:disabled) {
  border-color: var(--gray-400);
  background: var(--bg-hover);
}
.v-btn--secondary:active:not(:disabled) {
  background: var(--bg-active);
}

.v-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.v-btn--ghost:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.v-btn--ghost:active:not(:disabled) {
  background: var(--bg-active);
}

.v-btn--danger {
  background: var(--accent-red);
  color: #fff;
}
.v-btn--danger:hover:not(:disabled) {
  background: var(--accent-red-hover);
  transform: translateY(-0.5px);
}
.v-btn--danger:active:not(:disabled) {
  transform: translateY(0);
}

.v-btn--block { width: 100%; }

.v-btn__content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.v-btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: btn-spin 0.55s linear infinite;
}

.v-btn__content--hidden { visibility: hidden; }

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>
