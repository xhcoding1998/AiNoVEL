<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { useAuthStore } from '../stores/auth'
import VButton from '../components/ui/VButton.vue'
import VCard from '../components/ui/VCard.vue'
import VBadge from '../components/ui/VBadge.vue'
import VLoading from '../components/ui/VLoading.vue'

const router = useRouter()
const projectStore = useProjectStore()
const auth = useAuthStore()

onMounted(() => {
  projectStore.fetchProjects()
})

const statusMap = {
  draft: { label: '草稿', variant: 'default' },
  writing: { label: '写作中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' }
}
</script>

<template>
  <div class="page-container">
    <div class="dash-header">
      <div>
        <h1 class="page-title">欢迎回来，{{ auth.user?.username }}</h1>
        <p class="page-subtitle">管理你的小说项目</p>
      </div>
      <VButton variant="primary" @click="router.push('/projects')">
        查看所有项目
      </VButton>
    </div>

    <VLoading v-if="projectStore.loading" text="加载中..." />

    <div v-else-if="projectStore.projects.length" class="dash-grid">
      <VCard
        v-for="proj in projectStore.projects.slice(0, 6)"
        :key="proj.id"
        hoverable
        @click="router.push(`/projects/${proj.id}`)"
        style="cursor: pointer"
      >
        <div class="project-card">
          <div class="project-card__header">
            <h3 class="project-card__name">{{ proj.name }}</h3>
            <VBadge :variant="statusMap[proj.status]?.variant || 'default'">
              {{ statusMap[proj.status]?.label || proj.status }}
            </VBadge>
          </div>
          <p class="project-card__date">
            更新于 {{ new Date(proj.updated_at).toLocaleDateString('zh-CN') }}
          </p>
        </div>
      </VCard>
    </div>

    <div v-else class="dash-empty">
      <p class="dash-empty__text">还没有项目，开始创作吧</p>
      <VButton variant="primary" @click="router.push('/projects')">创建第一个项目</VButton>
    </div>
  </div>
</template>

<style scoped>
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-8);
}

.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.project-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.project-card__name {
  font-size: 15px;
  font-weight: 600;
}

.project-card__date {
  font-size: 13px;
  color: var(--text-tertiary);
}

.dash-empty {
  text-align: center;
  padding: var(--space-12) 0;
}

.dash-empty__text {
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}
</style>
