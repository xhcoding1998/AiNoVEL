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
    label: '仪表板',
    to: '/',
    icon: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="10" y="2" width="6" height="6" rx="1"/><rect x="2" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>'
  },
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
  { label: '设置', value: 'settings' },
  { label: '退出登录', value: 'logout', danger: true }
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
          <span class="sidebar-brand__logo">N</span>
          <span class="sidebar-brand__text">AI Novel</span>
        </div>
      </template>
      <template #footer>
        <VDropdown :items="userMenu" @select="handleUserMenu">
          <template #trigger>
            <div class="sidebar-user">
              <VAvatar :name="auth.user?.username || ''" :size="28" />
              <span class="sidebar-user__name">{{ auth.user?.username || '加载中...' }}</span>
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
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) 0;
}

.sidebar-brand__logo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--text-primary);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 15px;
}

.sidebar-brand__text {
  font-weight: 600;
  font-size: 15px;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) 0;
  cursor: pointer;
}

.sidebar-user__name {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
