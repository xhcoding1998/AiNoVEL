<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 32 },
  color: { type: String, default: '' }
})

const initial = computed(() => props.name ? props.name.charAt(0).toUpperCase() : '?')

const bgColor = computed(() => {
  if (props.color) return props.color
  const colors = ['#333', '#3b3b3b', '#444', '#2a2a2a', '#383838', '#404040']
  let hash = 0
  for (const ch of props.name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
})
</script>

<template>
  <div
    class="v-avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${size * 0.4}px`,
      background: bgColor
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
}
</style>
