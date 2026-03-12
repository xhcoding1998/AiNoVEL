<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  tabs: { type: Array, default: () => [] }
})

defineEmits(['update:modelValue'])

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

watch(() => props.modelValue, () => nextTick(updateIndicator))
onMounted(() => nextTick(updateIndicator))
</script>

<template>
  <div class="v-tabs" ref="tabsRef">
    <button
      v-for="tab in tabs"
      :key="tab.value ?? tab"
      class="v-tabs__item"
      :class="{ 'v-tabs__item--active': modelValue === (tab.value ?? tab) }"
      @click="$emit('update:modelValue', tab.value ?? tab)"
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
  overflow-x: auto;
  scrollbar-width: none;
}

.v-tabs::-webkit-scrollbar {
  display: none;
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
}

.v-tabs__item:hover {
  color: var(--text-secondary);
}

.v-tabs__item--active {
  color: var(--text-primary);
}

.v-tabs__indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--accent-primary);
  border-radius: 1px 1px 0 0;
  transition: all 300ms var(--ease-out-expo);
}
</style>
