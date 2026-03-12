<script setup>
defineProps({
  size: { type: Number, default: 24 },
  text: { type: String, default: '' }
})
</script>

<template>
  <div class="v-loading">
    <div class="v-loading__spinner" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.15" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </div>
    <span v-if="text" class="v-loading__text">{{ text }}</span>
  </div>
</template>

<style scoped>
.v-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-10);
}

.v-loading__spinner {
  color: var(--accent-primary);
  animation: loading-spin 0.7s linear infinite;
}

.v-loading__text {
  font-size: 13px;
  color: var(--text-tertiary);
  letter-spacing: -0.01em;
}

@keyframes loading-spin {
  to { transform: rotate(360deg); }
}
</style>
