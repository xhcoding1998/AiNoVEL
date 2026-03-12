<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  items: { type: Array, default: () => [] },
  position: { type: String, default: 'bottom-end' },
  width: { type: String, default: '180px' }
})

const emit = defineEmits(['select'])
const open = ref(false)
const root = ref(null)

function handleSelect(item) {
  emit('select', item)
  open.value = false
}

function toggle() {
  open.value = !open.value
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))

const isUp = (pos) => pos.startsWith('top')
</script>

<template>
  <div class="v-dropdown" ref="root">
    <div class="v-dropdown__trigger" @click.stop="toggle">
      <slot name="trigger" />
    </div>
    <Transition :name="isUp(position) ? 'dropdown-up' : 'dropdown'">
      <div
        v-if="open"
        class="v-dropdown__menu"
        :class="[`v-dropdown__menu--${position}`]"
        :style="{ minWidth: width }"
      >
        <div
          v-for="item in items"
          :key="item.value ?? item"
          class="v-dropdown__item"
          :class="{ 'v-dropdown__item--danger': item.danger }"
          @click.stop="handleSelect(item)"
        >
          <span v-if="item.icon" class="v-dropdown__item-icon" v-html="item.icon" />
          <span>{{ item.label ?? item }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.v-dropdown {
  position: relative;
  display: inline-flex;
}

.v-dropdown__trigger {
  cursor: pointer;
  display: inline-flex;
}

.v-dropdown__menu {
  position: absolute;
  z-index: var(--z-dropdown);
  padding: 4px;
  background: var(--bg-glass);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.v-dropdown__menu--bottom-end,
.v-dropdown__menu--bottom-start {
  top: calc(100% + 6px);
}

.v-dropdown__menu--bottom-end {
  right: 0;
}

.v-dropdown__menu--bottom-start {
  left: 0;
}

.v-dropdown__menu--top-end,
.v-dropdown__menu--top-start {
  bottom: calc(100% + 6px);
}

.v-dropdown__menu--top-end {
  right: 0;
}

.v-dropdown__menu--top-start {
  left: 0;
}

.v-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.v-dropdown__item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-dropdown__item--danger {
  color: var(--accent-red);
}

.v-dropdown__item--danger:hover {
  background: var(--accent-red-subtle);
  color: var(--accent-red);
}

.v-dropdown__item-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
