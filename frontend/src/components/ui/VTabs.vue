<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  tabs: { type: Array, default: () => [] }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="v-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.value ?? tab"
      class="v-tabs__item"
      :class="{ 'v-tabs__item--active': modelValue === (tab.value ?? tab) }"
      @click="$emit('update:modelValue', tab.value ?? tab)"
    >
      {{ tab.label ?? tab }}
    </button>
  </div>
</template>

<style scoped>
.v-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}

.v-tabs__item {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
  white-space: nowrap;
  margin-bottom: -1px;
}

.v-tabs__item:hover {
  color: var(--text-primary);
}

.v-tabs__item--active {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}
</style>
