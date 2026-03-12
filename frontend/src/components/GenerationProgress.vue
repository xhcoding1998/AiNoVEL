<script setup>
import { computed, ref, watch } from 'vue'
import GenerationLog from './GenerationLog.vue'

const props = defineProps({
  status: { type: String, default: 'idle' },
  currentStep: { type: String, default: null },
  completedSteps: { type: Array, default: () => [] },
  steps: { type: Array, default: () => [] },
  stepLabels: { type: Object, default: () => ({}) },
  projectId: { type: [String, Number], default: null }
})

const emit = defineEmits(['continue', 'regenerate', 'stop'])

const expanded = ref(false)

watch(() => props.status, (val) => {
  if (val === 'generating') expanded.value = true
}, { immediate: true })

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
  <div class="gen-banner" :class="`gen-banner--${status}`">
    <div class="gen-banner__main">
      <div class="gen-banner__left">
        <div v-if="status === 'generating'" class="gen-banner__spinner" />
        <svg v-else-if="status === 'completed'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="8" fill="var(--accent-green)" />
          <path d="M5 8.5L7 10.5L11 6" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="status === 'failed'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="8" fill="var(--accent-red)" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" />
        </svg>

        <span class="gen-banner__text">
          <template v-if="status === 'generating'">
            正在生成「{{ stepLabels[currentStep] || currentStep }}」
          </template>
          <template v-else-if="status === 'completed'">
            物料生成完成
          </template>
          <template v-else-if="status === 'failed'">
            「{{ stepLabels[currentStep] || currentStep }}」生成失败
          </template>
        </span>

        <span class="gen-banner__counter">{{ completedSteps.length }}/{{ steps.length }}</span>

        <div class="gen-banner__bar">
          <div class="gen-banner__fill" :style="{ width: progress + '%' }" />
        </div>
      </div>

      <div class="gen-banner__right">
        <template v-if="status === 'generating'">
          <button class="gen-action gen-action--danger" @click="$emit('stop')">停止生成</button>
        </template>
        <template v-if="status === 'failed'">
          <button class="gen-action gen-action--primary" @click="$emit('continue')">继续生成</button>
          <button class="gen-action gen-action--ghost" @click="$emit('regenerate')">重新生成</button>
        </template>
        <button class="gen-expand" @click="expanded = !expanded" :title="expanded ? '收起' : '展开详情'">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"
            :style="{ transform: expanded ? 'rotate(180deg)' : 'none' }">
            <path d="M3 5.5L7 9.5L11 5.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <Transition name="slide">
      <div v-if="expanded" class="gen-banner__detail-wrap">
        <div class="gen-banner__detail">
          <div
            v-for="(step, i) in steps"
            :key="step"
            class="gen-detail-step"
            :class="`gen-detail-step--${getStepState(step)}`"
          >
            <div class="gen-detail-step__icon">
              <template v-if="getStepState(step) === 'done'">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </template>
              <template v-else-if="getStepState(step) === 'active'">
                <div class="gen-detail-step__pulse" />
              </template>
              <template v-else-if="getStepState(step) === 'failed'">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </template>
              <template v-else>
                <span class="gen-detail-step__num">{{ i + 1 }}</span>
              </template>
            </div>
            <span class="gen-detail-step__label">{{ stepLabels[step] || step }}</span>
          </div>
        </div>
        <GenerationLog
          v-if="projectId && (status === 'generating' || status === 'failed')"
          :project-id="projectId"
          :active="status === 'generating'"
          :status="status"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.gen-banner {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.gen-banner--generating {
  border-color: rgba(0, 112, 243, 0.25);
}

.gen-banner--completed {
  border-color: rgba(0, 168, 107, 0.25);
}

.gen-banner--failed {
  border-color: rgba(238, 68, 68, 0.25);
}

.gen-banner__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 12px;
}

.gen-banner__left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.gen-banner__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 112, 243, 0.2);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: gen-spin 0.7s linear infinite;
  flex-shrink: 0;
}

.gen-banner__text {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gen-banner__counter {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.gen-banner__bar {
  width: 80px;
  height: 3px;
  background: var(--bg-active);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.gen-banner__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s var(--ease-out-expo);
}

.gen-banner--generating .gen-banner__fill {
  background: var(--accent-blue);
  animation: barPulse 2s ease infinite;
}

.gen-banner--completed .gen-banner__fill {
  background: var(--accent-green);
}

.gen-banner--failed .gen-banner__fill {
  background: var(--accent-red);
}

.gen-banner__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.gen-action {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.gen-action--primary {
  background: var(--accent-blue);
  color: #fff;
}

.gen-action--primary:hover {
  opacity: 0.85;
}

.gen-action--danger {
  background: rgba(238, 68, 68, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(238, 68, 68, 0.2);
}

.gen-action--danger:hover {
  background: rgba(238, 68, 68, 0.18);
}

.gen-action--ghost {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.gen-action--ghost:hover {
  color: var(--text-primary);
  background: var(--bg-active);
}

.gen-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
}

.gen-expand:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.gen-expand svg {
  transition: transform var(--transition-normal);
}

/* Detail panel */
.gen-banner__detail-wrap {
  border-top: 1px solid var(--border-default);
  padding: 10px 12px;
}

.gen-banner__detail {
  display: flex;
  gap: 2px;
}

.gen-detail-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 2px;
  border-radius: var(--radius-sm);
}

.gen-detail-step--active {
  background: rgba(0, 112, 243, 0.06);
}

.gen-detail-step--failed {
  background: rgba(238, 68, 68, 0.06);
}

.gen-detail-step__icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
}

.gen-detail-step--done .gen-detail-step__icon {
  background: var(--accent-green);
  color: #fff;
}

.gen-detail-step--active .gen-detail-step__icon {
  background: var(--accent-blue);
  color: #fff;
}

.gen-detail-step--failed .gen-detail-step__icon {
  background: var(--accent-red);
  color: #fff;
}

.gen-detail-step--pending .gen-detail-step__icon {
  background: var(--bg-active);
  color: var(--text-tertiary);
}

.gen-detail-step__pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1.2s ease infinite;
}

.gen-detail-step__num {
  font-size: 10px;
  font-family: var(--font-mono);
}

.gen-detail-step__label {
  font-size: 10px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
}

.gen-detail-step--done .gen-detail-step__label {
  color: var(--accent-green);
}

.gen-detail-step--active .gen-detail-step__label {
  color: var(--accent-blue);
  font-weight: 500;
}

.gen-detail-step--failed .gen-detail-step__label {
  color: var(--accent-red);
}

/* Animations */
@keyframes gen-spin {
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

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 400px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

@media (max-width: 640px) {
  .gen-banner__bar { width: 48px; }
  .gen-detail-step__label { font-size: 9px; }
}
</style>
