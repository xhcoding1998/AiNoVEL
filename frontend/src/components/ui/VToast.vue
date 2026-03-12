<script setup>
import { useToast } from '../../composables/useToast'

const { toasts, removeToast } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="v-toast__container">
      <TransitionGroup name="slide-up">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="v-toast"
          :class="`v-toast--${toast.type}`"
          @click="removeToast(toast.id)"
        >
          <span class="v-toast__dot" />
          <span class="v-toast__message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.v-toast__container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: var(--bg-glass);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  cursor: pointer;
  min-width: 260px;
  max-width: 420px;
}

.v-toast__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.v-toast--success .v-toast__dot { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green-subtle); }
.v-toast--error .v-toast__dot { background: var(--accent-red); box-shadow: 0 0 6px var(--accent-red-subtle); }
.v-toast--info .v-toast__dot { background: var(--accent-blue); box-shadow: 0 0 6px var(--accent-blue-subtle); }
.v-toast--warning .v-toast__dot { background: var(--accent-yellow); box-shadow: 0 0 6px var(--accent-yellow-subtle); }

.v-toast__message {
  color: var(--text-primary);
  line-height: 1.4;
}
</style>
