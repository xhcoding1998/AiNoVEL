<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="v-input" :class="{ 'v-input--error': error, 'v-input--disabled': disabled }">
    <label v-if="label" class="v-input__label">{{ label }}</label>
    <div class="v-input__wrapper">
      <input
        class="v-input__field"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <div class="v-input__focus-ring" />
    </div>
    <span v-if="error" class="v-input__error">{{ error }}</span>
    <span v-else-if="hint" class="v-input__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.v-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.v-input__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.v-input__wrapper {
  position: relative;
}

.v-input__field {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.v-input__field::placeholder {
  color: var(--text-tertiary);
}

.v-input__field:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px var(--accent-blue-subtle);
}

.v-input--error .v-input__field {
  border-color: var(--accent-red);
}

.v-input--error .v-input__field:focus {
  box-shadow: 0 0 0 3px var(--accent-red-subtle);
}

.v-input__error {
  font-size: 12px;
  color: var(--accent-red);
}

.v-input__hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.v-input--disabled .v-input__field {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
