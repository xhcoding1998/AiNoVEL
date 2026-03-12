<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: Number, default: 4 },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="v-textarea" :class="{ 'v-textarea--error': error }">
    <label v-if="label" class="v-textarea__label">{{ label }}</label>
    <textarea
      class="v-textarea__field"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="error" class="v-textarea__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.v-textarea {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.v-textarea__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.v-textarea__field {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color var(--transition-fast);
}

.v-textarea__field::placeholder {
  color: var(--text-tertiary);
}

.v-textarea__field:focus {
  border-color: var(--border-focus);
}

.v-textarea--error .v-textarea__field {
  border-color: var(--accent-red);
}

.v-textarea__error {
  font-size: 12px;
  color: var(--accent-red);
}
</style>
