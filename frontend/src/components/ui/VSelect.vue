<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  error: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])
const open = ref(false)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => (o.value ?? o) === props.modelValue)
  return opt ? (opt.label ?? opt) : ''
})

function select(val) {
  emit('update:modelValue', val)
  open.value = false
}
</script>

<template>
  <div class="v-select" :class="{ 'v-select--open': open, 'v-select--error': error }">
    <label v-if="label" class="v-select__label">{{ label }}</label>
    <div class="v-select__trigger" @click="open = !open" tabindex="0" @blur="open = false">
      <span :class="selectedLabel ? '' : 'v-select__placeholder'">
        {{ selectedLabel || placeholder }}
      </span>
      <svg class="v-select__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <Transition name="fade">
      <div v-if="open" class="v-select__dropdown">
        <div
          v-for="opt in options"
          :key="opt.value ?? opt"
          class="v-select__option"
          :class="{ 'v-select__option--active': (opt.value ?? opt) === modelValue }"
          @mousedown.prevent="select(opt.value ?? opt)"
        >
          {{ opt.label ?? opt }}
        </div>
      </div>
    </Transition>
    <span v-if="error" class="v-select__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.v-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
}

.v-select__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.v-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  font-size: 14px;
}

.v-select__trigger:focus,
.v-select--open .v-select__trigger {
  border-color: var(--border-focus);
}

.v-select__placeholder {
  color: var(--text-tertiary);
}

.v-select__arrow {
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.v-select--open .v-select__arrow {
  transform: rotate(180deg);
}

.v-select__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  padding: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.v-select__option {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: background var(--transition-fast);
}

.v-select__option:hover {
  background: var(--bg-hover);
}

.v-select__option--active {
  color: var(--accent-blue);
}

.v-select--error .v-select__trigger {
  border-color: var(--accent-red);
}

.v-select__error {
  font-size: 12px;
  color: var(--accent-red);
}
</style>
