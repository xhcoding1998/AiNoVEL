<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  items: { type: Array, default: () => [] }
})

const route = useRoute()

function isActive(item) {
  if (item.to) return route.path === item.to || route.path.startsWith(item.to + '/')
  return false
}
</script>

<template>
  <nav class="v-sidebar">
    <div v-if="$slots.header" class="v-sidebar__header">
      <slot name="header" />
    </div>
    <div class="v-sidebar__nav">
      <template v-for="item in items" :key="item.to || item.label">
        <div v-if="item.divider" class="v-sidebar__divider" />
        <div v-else-if="item.section" class="v-sidebar__section">{{ item.section }}</div>
        <router-link
          v-else
          :to="item.to"
          class="v-sidebar__item"
          :class="{ 'v-sidebar__item--active': isActive(item) }"
        >
          <span v-if="item.icon" class="v-sidebar__icon" v-html="item.icon" />
          <span class="v-sidebar__label">{{ item.label }}</span>
          <VBadge v-if="item.badge" :variant="item.badgeVariant || 'default'" class="v-sidebar__badge">
            {{ item.badge }}
          </VBadge>
        </router-link>
      </template>
    </div>
    <div v-if="$slots.footer" class="v-sidebar__footer">
      <slot name="footer" />
    </div>
  </nav>
</template>

<script>
import VBadge from './VBadge.vue'
</script>

<style scoped>
.v-sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  z-index: var(--z-sticky);
}

.v-sidebar__header {
  padding: var(--space-4) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.v-sidebar__nav {
  flex: 1;
  padding: var(--space-3) var(--space-3);
  overflow-y: auto;
}

.v-sidebar__section {
  padding: var(--space-5) var(--space-3) var(--space-2);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.v-sidebar__divider {
  height: 1px;
  background: var(--border-default);
  margin: var(--space-2) var(--space-3);
}

.v-sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 9px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  position: relative;
}

.v-sidebar__item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.v-sidebar__item--active {
  color: var(--text-primary);
  background: var(--bg-active);
}

.v-sidebar__item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 0 2px 2px 0;
}

.v-sidebar__icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.7;
}

.v-sidebar__item--active .v-sidebar__icon,
.v-sidebar__item:hover .v-sidebar__icon {
  opacity: 1;
}

.v-sidebar__icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.v-sidebar__label {
  flex: 1;
}

.v-sidebar__badge {
  margin-left: auto;
}

.v-sidebar__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-default);
}
</style>
