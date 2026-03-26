<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '640px' }
})

const emit = defineEmits(['update:modelValue'])
function close() { emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="v-modal__overlay" @click.self="close">
        <div class="v-modal" :style="{ width: width }">
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
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.v-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: var(--z-modal, 200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.v-modal {
  position: relative;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-hover);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.04);
}

.v-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.v-modal__title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.v-modal__close {
  color: var(--text-tertiary);
  padding: 6px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.v-modal__close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-height: 0;
}
.v-modal__body::-webkit-scrollbar { width: 4px; }
.v-modal__body::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 2px; }

.v-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
  background: var(--bg-tertiary);
  border-radius: 0 0 14px 14px;
}

/* 动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .v-modal,
.modal-fade-leave-active .v-modal {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease;
}
.modal-fade-enter-from .v-modal,
.modal-fade-leave-to .v-modal {
  transform: scale(0.94) translateY(8px);
  opacity: 0;
}
</style>
