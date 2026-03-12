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
  const colors = ['#0070f3', '#00a86b', '#8b5cf6', '#f5a623', '#ee4444', '#06b6d4']
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
      fontSize: `${size * 0.42}px`,
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
  border-radius: 50%;
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
}
</style>
