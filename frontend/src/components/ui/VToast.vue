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
  padding: 10px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  cursor: pointer;
  min-width: 240px;
  max-width: 400px;
}

.v-toast__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.v-toast--success .v-toast__dot { background: var(--accent-green); }
.v-toast--error .v-toast__dot { background: var(--accent-red); }
.v-toast--info .v-toast__dot { background: var(--accent-blue); }
.v-toast--warning .v-toast__dot { background: var(--accent-yellow); }

.v-toast__message {
  color: var(--text-primary);
}
</style>
