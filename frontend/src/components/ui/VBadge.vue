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
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-full);
  line-height: 1.4;
}

.v-badge--default {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.v-badge--success {
  background: rgba(0, 168, 107, 0.15);
  color: var(--accent-green);
}

.v-badge--warning {
  background: rgba(245, 166, 35, 0.15);
  color: var(--accent-yellow);
}

.v-badge--danger {
  background: rgba(238, 68, 68, 0.15);
  color: var(--accent-red);
}

.v-badge--info {
  background: rgba(0, 112, 243, 0.15);
  color: var(--accent-blue);
}

.v-badge--purple {
  background: rgba(139, 92, 246, 0.15);
  color: var(--accent-purple);
}
</style>
