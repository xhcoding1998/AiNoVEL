<script setup>
defineProps({
  padding: { type: String, default: 'md' },
  hoverable: { type: Boolean, default: false }
})
</script>

<template>
  <div class="v-card" :class="[`v-card--${padding}`, { 'v-card--hoverable': hoverable }]">
    <div v-if="$slots.header" class="v-card__header">
      <slot name="header" />
    </div>
    <div class="v-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="v-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.v-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.v-card--hoverable:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.v-card--sm .v-card__body { padding: var(--space-3); }
.v-card--md .v-card__body { padding: var(--space-5); }
.v-card--lg .v-card__body { padding: var(--space-6); }

.v-card__header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
  font-weight: 600;
  font-size: 14px;
}

.v-card__footer {
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-default);
}
</style>
