<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  tabs: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  disabledTabs: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const tabsRef = ref(null)
const indicatorStyle = ref({})

function updateIndicator() {
  if (!tabsRef.value) return
  const active = tabsRef.value.querySelector('.v-tabs__item--active')
  if (active) {
    indicatorStyle.value = {
      width: `${active.offsetWidth}px`,
      transform: `translateX(${active.offsetLeft}px)`
    }
  }
}

function isTabDisabled(val) {
  if (props.disabled) return true
  return props.disabledTabs.includes(val)
}

function handleClick(val) {
  if (isTabDisabled(val)) return
  emit('update:modelValue', val)
}

watch(() => props.modelValue, () => nextTick(updateIndicator))
onMounted(() => nextTick(updateIndicator))
</script>

<template>
  <div class="v-tabs" :class="{ 'v-tabs--disabled': disabled }" ref="tabsRef">
    <button
      v-for="tab in tabs"
      :key="tab.value ?? tab"
      class="v-tabs__item"
      :class="{
        'v-tabs__item--active': modelValue === (tab.value ?? tab),
        'v-tabs__item--disabled': isTabDisabled(tab.value ?? tab)
      }"
      :disabled="isTabDisabled(tab.value ?? tab)"
      @click="handleClick(tab.value ?? tab)"
    >
      {{ tab.label ?? tab }}
    </button>
    <div class="v-tabs__indicator" :style="indicatorStyle" />
  </div>
</template>

<style scoped>
.v-tabs {
  display: flex;
  gap: 0;
  position: relative;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-primary);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.v-tabs::-webkit-scrollbar {
  display: none;
}

.v-tabs--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.v-tabs__item {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  border-bottom: none;
  transition: color var(--transition-fast);
  white-space: nowrap;
  position: relative;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.v-tabs__item:hover:not(:disabled) {
  color: var(--text-secondary);
}

.v-tabs__item:disabled,
.v-tabs__item--disabled {
  cursor: not-allowed;
  opacity: 0.4;
  pointer-events: none;
}

.v-tabs__item--active {
  color: var(--tab-active-color);
}

.v-tabs__indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--tab-indicator);
  border-radius: 1px 1px 0 0;
  transition: all 300ms var(--ease-out-expo);
}
</style>
