<script setup>
import { ref } from 'vue'

defineProps({
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])
const open = ref(false)

function handleSelect(item) {
  emit('select', item)
  open.value = false
}
</script>

<template>
  <div class="v-dropdown" @blur="open = false" tabindex="0">
    <div @click="open = !open">
      <slot name="trigger" />
    </div>
    <Transition name="fade">
      <div v-if="open" class="v-dropdown__menu">
        <div
          v-for="item in items"
          :key="item.value ?? item"
          class="v-dropdown__item"
          :class="{ 'v-dropdown__item--danger': item.danger }"
          @mousedown.prevent="handleSelect(item)"
          @click.stop
        >
          {{ item.label ?? item }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.v-dropdown {
  position: relative;
  display: inline-block;
}

.v-dropdown__menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  padding: 4px;
}

.v-dropdown__item {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.v-dropdown__item:hover {
  background: var(--bg-hover);
}

.v-dropdown__item--danger {
  color: var(--accent-red);
}
</style>
