<script setup>
defineProps({
  variant: { type: String, default: 'default' }
})
</script>

<template>
  <span class="v-badge" :class="`v-badge--${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.v-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-full);
  line-height: 1.5;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}

.v-badge--default {
  background: var(--bg-active);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.v-badge--success {
  background: var(--accent-green-subtle);
  color: var(--accent-green);
  border-color: rgba(0, 168, 107, 0.15);
}

.v-badge--warning {
  background: var(--accent-yellow-subtle);
  color: var(--accent-yellow);
  border-color: rgba(245, 166, 35, 0.15);
}

.v-badge--danger {
  background: var(--accent-red-subtle);
  color: var(--accent-red);
  border-color: rgba(238, 68, 68, 0.15);
}

.v-badge--info {
  background: var(--accent-blue-subtle);
  color: var(--accent-blue);
  border-color: rgba(0, 112, 243, 0.15);
}

.v-badge--purple {
  background: var(--accent-purple-subtle);
  color: var(--accent-purple);
  border-color: rgba(139, 92, 246, 0.15);
}
</style>
