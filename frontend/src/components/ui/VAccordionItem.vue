<script setup>
defineProps({
  title: { type: String, default: '' },
  open: { type: Boolean, default: false }
})
defineEmits(['toggle'])
</script>

<template>
  <div class="v-accordion-item" :class="{ 'v-accordion-item--open': open }">
    <button type="button" class="v-accordion-item__header" :aria-expanded="open" @click="$emit('toggle')">
      <span class="v-accordion-item__title">{{ title }}</span>
      <svg class="v-accordion-item__chevron" :class="{ 'v-accordion-item__chevron--open': open }" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <Transition name="accordion">
      <div v-show="open" class="v-accordion-item__body">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.v-accordion-item {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast);
}

.v-accordion-item:hover {
  border-color: var(--border-hover);
}

.v-accordion-item--open {
  border-color: var(--accordion-open-border);
}

.v-accordion-item--open .v-accordion-item__header {
  background: var(--accordion-open-bg);
  color: var(--text-primary);
}

.v-accordion-item--open .v-accordion-item__header .v-accordion-item__chevron {
  color: var(--accordion-open-border);
}

.v-accordion-item__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-nested);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
}

.v-accordion-item__header:hover {
  background: var(--bg-hover);
}

.v-accordion-item__title {
  flex: 1;
  min-width: 0;
}

.v-accordion-item__chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform var(--transition-normal);
}

.v-accordion-item__chevron--open {
  transform: rotate(180deg);
}

.v-accordion-item__body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-default);
}

.v-accordion-item__body :deep(.v-input),
.v-accordion-item__body :deep(.v-textarea) {
  margin-top: 12px;
}

.v-accordion-item__body :deep(.v-input:first-child),
.v-accordion-item__body :deep(.v-textarea:first-child) {
  margin-top: 12px;
}

.accordion-enter-active,
.accordion-leave-active {
  /* transition: opacity 0.2s ease, transform 0.2s ease; */
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
}

</style>
