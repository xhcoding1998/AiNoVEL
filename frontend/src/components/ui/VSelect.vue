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
    <Transition name="dropdown">
      <div v-if="open" class="v-select__dropdown">
        <div
          v-for="opt in options"
          :key="opt.value ?? opt"
          class="v-select__option"
          :class="{ 'v-select__option--active': (opt.value ?? opt) === modelValue }"
          @mousedown.prevent="select(opt.value ?? opt)"
        >
          {{ opt.label ?? opt }}
          <svg v-if="(opt.value ?? opt) === modelValue" class="v-select__check" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
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
  gap: 6px;
  position: relative;
}

.v-select__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.v-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  font-size: 14px;
}

.v-select__trigger:focus,
.v-select--open .v-select__trigger {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px var(--accent-blue-subtle);
}

.v-select__placeholder {
  color: var(--text-tertiary);
}

.v-select__arrow {
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
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
  background: var(--bg-glass);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  padding: 4px;
  max-height: 220px;
  overflow-y: auto;
}

.v-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.v-select__option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.v-select__option--active {
  color: var(--accent-blue);
}

.v-select__check {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.v-select--error .v-select__trigger {
  border-color: var(--accent-red);
}

.v-select__error {
  font-size: 12px;
  color: var(--accent-red);
}
</style>
