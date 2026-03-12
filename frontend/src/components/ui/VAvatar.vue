<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 32 },
  color: { type: String, default: '' }
})

const initial = computed(() => props.name ? props.name.charAt(0).toUpperCase() : '?')
</script>

<template>
  <div
    class="v-avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${size * 0.4}px`
    }"
  >
    {{ initial }}
  </div>
</template>

<style scoped>
.v-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  color: var(--text-primary);
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
  letter-spacing: -0.02em;
  border: 1px solid var(--border-default);
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
}
</style>
