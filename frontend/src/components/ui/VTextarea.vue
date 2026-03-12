<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: Number, default: 4 },
  minRows: { type: Number, default: 3 },
  maxHeight: { type: Number, default: 500 },
  noResize: { type: Boolean, default: false },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="v-textarea" :class="{ 'v-textarea--error': error, 'v-textarea--no-resize': noResize }">
    <label v-if="label" class="v-textarea__label">{{ label }}</label>
    <textarea
      class="v-textarea__field"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="Math.max(rows, minRows)"
      :disabled="disabled"
      :style="{ maxHeight: maxHeight + 'px' }"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="error" class="v-textarea__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.v-textarea {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.v-textarea__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.v-textarea__field {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
  resize: vertical;
  min-height: 280px;
  overflow-y: auto;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.v-textarea--no-resize .v-textarea__field {
  resize: none;
}

.v-textarea__field::placeholder {
  color: var(--text-tertiary);
}

.v-textarea__field:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px var(--accent-blue-subtle);
}

.v-textarea--error .v-textarea__field {
  border-color: var(--accent-red);
}

.v-textarea--error .v-textarea__field:focus {
  box-shadow: 0 0 0 3px var(--accent-red-subtle);
}

.v-textarea__error {
  font-size: 12px;
  color: var(--accent-red);
}
</style>
