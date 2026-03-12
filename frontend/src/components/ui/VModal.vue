<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '480px' }
})

const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="v-modal__overlay" @click.self="close">
        <Transition name="scale">
          <div v-if="modelValue" class="v-modal" :style="{ maxWidth: width }">
            <div class="v-modal__header">
              <h3 class="v-modal__title">{{ title }}</h3>
              <button class="v-modal__close" @click="close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <div class="v-modal__body">
              <slot />
            </div>
            <div v-if="$slots.footer" class="v-modal__footer">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.v-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-6);
}

.v-modal {
  width: 100%;
  max-height: calc(100vh - var(--space-6) * 2);
  display: flex;
  flex-direction: column;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.v-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.v-modal__title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.v-modal__close {
  color: var(--text-tertiary);
  padding: 6px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.v-modal__close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-modal__body {
  padding: var(--space-6);
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.v-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}
</style>
