<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '520px' }
})

const emit = defineEmits(['update:modelValue'])
function close() { emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-overlay">
      <div v-if="modelValue" class="v-drawer__overlay" @click.self="close" />
    </Transition>
    <Transition name="drawer-panel">
      <div v-if="modelValue" class="v-drawer" :style="{ width: width }">
        <div class="v-drawer__header">
          <h3 class="v-drawer__title">{{ title }}</h3>
          <button class="v-drawer__close" @click="close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="v-drawer__body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="v-drawer__footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.v-drawer__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: var(--z-modal, 200);
}

.v-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--bg-tertiary);
  border-left: 1px solid var(--border-hover);
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.18);
  z-index: calc(var(--z-modal, 200) + 1);
}

.v-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.v-drawer__title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.v-drawer__close {
  color: var(--text-tertiary);
  padding: 6px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.v-drawer__close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-height: 0;
}

.v-drawer__body::-webkit-scrollbar { width: 4px; }
.v-drawer__body::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 2px; }

.v-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
  background: var(--bg-secondary);
}

/* 动画 */
.drawer-overlay-enter-active,
.drawer-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-overlay-enter-from,
.drawer-overlay-leave-to {
  opacity: 0;
}

.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-panel-enter-from,
.drawer-panel-leave-to {
  transform: translateX(100%);
}
</style>
