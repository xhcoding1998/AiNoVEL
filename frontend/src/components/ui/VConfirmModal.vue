<script setup>
import VModal from './VModal.vue'
import VButton from './VButton.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  width: { type: String, default: '440px' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  confirmVariant: { type: String, default: 'danger' },
  loading: { type: Boolean, default: false },
  affectedSteps: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <VModal :modelValue="modelValue" @update:modelValue="v => $emit('update:modelValue', v)" :title="title" :width="width">
    <div class="confirm-content">
      <div class="confirm-warning">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="confirm-warning__icon">
          <path d="M10 2L1.5 17h17L10 2z" stroke="var(--accent-yellow)" stroke-width="1.5" fill="var(--accent-yellow-subtle)" stroke-linejoin="round"/>
          <path d="M10 8v4" stroke="var(--accent-yellow)" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="14.5" r="0.8" fill="var(--accent-yellow)"/>
        </svg>
        <div class="confirm-warning__text">
          <slot />
        </div>
      </div>
      <div v-if="affectedSteps.length" class="confirm-affected">
        <div class="confirm-affected__label">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M7 1v6l3 3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="7" cy="7" r="6"/>
          </svg>
          以下内容将被重新生成：
        </div>
        <div class="confirm-affected__tags">
          <span v-for="step in affectedSteps" :key="step" class="confirm-affected__tag">{{ step }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <VButton variant="secondary" @click="close" :disabled="loading">{{ cancelText }}</VButton>
      <VButton :variant="confirmVariant" :loading="loading" @click="confirm">{{ confirmText }}</VButton>
    </template>
  </VModal>
</template>

<style scoped>
.confirm-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.confirm-warning {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--accent-yellow-subtle);
  border: 1px solid rgba(245, 166, 35, 0.2);
  border-radius: var(--radius-md);
}

.confirm-warning__icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.confirm-warning__text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.confirm-warning__text :deep(p) {
  margin: 0;
}

.confirm-affected {
  background: var(--bg-nested);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.confirm-affected__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
  margin-bottom: var(--space-2);
}

.confirm-affected__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.confirm-affected__tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-yellow);
  background: var(--accent-yellow-subtle);
  border: 1px solid rgba(245, 166, 35, 0.2);
  border-radius: var(--radius-sm);
}
</style>
