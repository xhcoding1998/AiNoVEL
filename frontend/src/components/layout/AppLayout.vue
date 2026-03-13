<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import VSidebar from '../ui/VSidebar.vue'
import VAvatar from '../ui/VAvatar.vue'
import VDropdown from '../ui/VDropdown.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navItems = computed(() => [
  { section: '导航' },
  {
    label: '我的项目',
    to: '/projects',
    icon: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5h14M2 9h14M2 13h10"/></svg>'
  },
  { divider: true },
  { section: '系统' },
  {
    label: '设置',
    to: '/settings',
    icon: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="3"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4"/></svg>'
  }
])

const userMenu = [
  {
    label: '设置',
    value: 'settings',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1"/></svg>'
  },
  {
    label: '退出登录',
    value: 'logout',
    danger: true,
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M11 11l3-3-3-3M14 8H6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
]

function handleUserMenu(item) {
  if (item.value === 'logout') {
    auth.logout()
    router.push('/login')
  } else if (item.value === 'settings') {
    router.push('/settings')
  }
}
</script>

<template>
  <div class="app-layout">
    <VSidebar :items="navItems">
      <template #header>
        <div class="sidebar-brand">
          <div class="sidebar-brand__logo">
            <span class="sidebar-brand__letter">N</span>
          </div>
          <div class="sidebar-brand__text">
            <span class="sidebar-brand__name">笔来</span>
            <span class="sidebar-brand__tag">创作平台</span>
          </div>
        </div>
      </template>
      <template #footer>
        <VDropdown :items="userMenu" position="top-start" @select="handleUserMenu">
          <template #trigger>
            <div class="sidebar-user">
              <VAvatar :name="auth.user?.username || ''" :size="30" />
              <div class="sidebar-user__info">
                <span class="sidebar-user__name">{{ auth.user?.username || '加载中...' }}</span>
                <span class="sidebar-user__email">{{ auth.user?.email || '' }}</span>
              </div>
              <svg class="sidebar-user__chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.5 5.5L7 3L9.5 5.5M4.5 8.5L7 11L9.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </template>
        </VDropdown>
      </template>
    </VSidebar>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  background: var(--bg-primary);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) 0;
}

.sidebar-brand__logo {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--text-primary);
  border-radius: var(--radius-md);
}

.sidebar-brand__letter {
  font-weight: 800;
  font-size: 16px;
  color: var(--bg-primary);
  line-height: 1;
}

.sidebar-brand__text {
  display: flex;
  flex-direction: column;
}

.sidebar-brand__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.sidebar-brand__tag {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 6px 8px;
  margin: -6px -8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.sidebar-user:hover {
  background: var(--bg-hover);
}

.sidebar-user__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-user__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.sidebar-user__email {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.sidebar-user__chevron {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.sidebar-user:hover .sidebar-user__chevron {
  color: var(--text-secondary);
}
</style>
