<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'idle' },
  currentStep: { type: String, default: null },
  completedSteps: { type: Array, default: () => [] },
  steps: { type: Array, default: () => [] },
  stepLabels: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['continue', 'regenerate'])

const progress = computed(() => {
  if (!props.steps.length) return 0
  if (props.status === 'completed') return 100
  return Math.round((props.completedSteps.length / props.steps.length) * 100)
})

function getStepState(step) {
  if (props.completedSteps.includes(step)) return 'done'
  if (props.currentStep === step && props.status === 'generating') return 'active'
  if (props.currentStep === step && props.status === 'failed') return 'failed'
  return 'pending'
}
</script>

<template>
  <div class="gen-progress" :class="`gen-progress--${status}`">
    <!-- Header -->
    <div class="gen-progress__header">
      <div class="gen-progress__title">
        <div v-if="status === 'generating'" class="gen-progress__spinner" />
        <svg v-else-if="status === 'completed'" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill="var(--accent-green)" />
          <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="status === 'failed'" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill="var(--accent-red)" />
          <path d="M6 6l6 6M12 6l-6 6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span>
          <template v-if="status === 'generating'">
            AI 正在生成「{{ stepLabels[currentStep] || currentStep }}」...
          </template>
          <template v-else-if="status === 'completed'">
            全部物料生成完成
          </template>
          <template v-else-if="status === 'failed'">
            「{{ stepLabels[currentStep] || currentStep }}」生成失败
          </template>
        </span>
        <span class="gen-progress__pct">{{ progress }}%</span>
      </div>
      <div v-if="status === 'failed'" class="gen-progress__actions">
        <button class="gen-btn gen-btn--continue" @click="$emit('continue')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 7h10M8 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          继续生成
        </button>
        <button class="gen-btn gen-btn--regen" @click="$emit('regenerate')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M1.5 7a5.5 5.5 0 019.81-3.37M12.5 7a5.5 5.5 0 01-9.81 3.37" stroke-linecap="round"/>
            <path d="M11 1v3h-3M3 10v3h3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          全部重新生成
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="gen-progress__bar">
      <div class="gen-progress__fill" :style="{ width: progress + '%' }" />
    </div>

    <!-- Steps -->
    <div class="gen-progress__steps">
      <div
        v-for="(step, i) in steps"
        :key="step"
        class="gen-step"
        :class="`gen-step--${getStepState(step)}`"
      >
        <div class="gen-step__indicator">
          <template v-if="getStepState(step) === 'done'">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </template>
          <template v-else-if="getStepState(step) === 'active'">
            <div class="gen-step__pulse" />
          </template>
          <template v-else-if="getStepState(step) === 'failed'">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </template>
          <template v-else>
            <span class="gen-step__num">{{ i + 1 }}</span>
          </template>
        </div>
        <span class="gen-step__label">{{ stepLabels[step] || step }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gen-progress {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  margin-bottom: 24px;
}

.gen-progress--generating {
  border-color: rgba(0, 112, 243, 0.3);
  background: linear-gradient(135deg, rgba(0, 112, 243, 0.04), rgba(0, 112, 243, 0.02));
}

.gen-progress--completed {
  border-color: rgba(0, 168, 107, 0.3);
  background: linear-gradient(135deg, rgba(0, 168, 107, 0.04), rgba(0, 168, 107, 0.02));
}

.gen-progress--failed {
  border-color: rgba(238, 68, 68, 0.3);
  background: linear-gradient(135deg, rgba(238, 68, 68, 0.04), rgba(238, 68, 68, 0.02));
}

.gen-progress__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.gen-progress__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.gen-progress__pct {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-left: 4px;
}

.gen-progress__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 112, 243, 0.2);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.gen-progress__actions {
  display: flex;
  gap: 8px;
}

.gen-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 0.15s;
  cursor: pointer;
}

.gen-btn--continue {
  background: var(--accent-blue);
  color: #fff;
}

.gen-btn--continue:hover {
  opacity: 0.9;
}

.gen-btn--regen {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.gen-btn--regen:hover {
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.gen-progress__bar {
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.gen-progress__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.gen-progress--generating .gen-progress__fill {
  background: var(--accent-blue);
  animation: barPulse 2s ease infinite;
}

.gen-progress--completed .gen-progress__fill {
  background: var(--accent-green);
}

.gen-progress--failed .gen-progress__fill {
  background: var(--accent-red);
}

.gen-progress__steps {
  display: flex;
  gap: 4px;
}

.gen-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.gen-step--active {
  background: rgba(0, 112, 243, 0.08);
}

.gen-step--failed {
  background: rgba(238, 68, 68, 0.08);
}

.gen-step__indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s;
}

.gen-step--done .gen-step__indicator {
  background: var(--accent-green);
  color: #fff;
}

.gen-step--active .gen-step__indicator {
  background: var(--accent-blue);
  color: #fff;
}

.gen-step--failed .gen-step__indicator {
  background: var(--accent-red);
  color: #fff;
}

.gen-step--pending .gen-step__indicator {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

.gen-step__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1.2s ease infinite;
}

.gen-step__num {
  font-size: 11px;
}

.gen-step__label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.3;
  white-space: nowrap;
}

.gen-step--done .gen-step__label {
  color: var(--accent-green);
}

.gen-step--active .gen-step__label {
  color: var(--accent-blue);
  font-weight: 500;
}

.gen-step--failed .gen-step__label {
  color: var(--accent-red);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes barPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@media (max-width: 640px) {
  .gen-step__label {
    font-size: 10px;
  }
}
</style>
