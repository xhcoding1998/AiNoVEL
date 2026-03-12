<script setup>
defineProps({
  size: { type: Number, default: 24 },
  text: { type: String, default: '' }
})
</script>

<template>
  <div class="v-loading">
    <svg class="v-loading__spinner" :width="size" :height="size" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
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
  padding: var(--space-8);
}

.v-loading__spinner {
  color: var(--text-tertiary);
  animation: spin 0.8s linear infinite;
}

.v-loading__text {
  font-size: 13px;
  color: var(--text-secondary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
