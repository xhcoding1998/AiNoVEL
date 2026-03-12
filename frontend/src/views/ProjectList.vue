<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { useToast } from '../composables/useToast'
import VButton from '../components/ui/VButton.vue'
import VCard from '../components/ui/VCard.vue'
import VBadge from '../components/ui/VBadge.vue'
import VModal from '../components/ui/VModal.vue'
import VInput from '../components/ui/VInput.vue'
import VTextarea from '../components/ui/VTextarea.vue'
import VLoading from '../components/ui/VLoading.vue'
import VDropdown from '../components/ui/VDropdown.vue'

const router = useRouter()
const store = useProjectStore()
const toast = useToast()

const showCreate = ref(false)
const newPrompt = ref('')
const newName = ref('')
const creating = ref(false)

onMounted(() => store.fetchProjects())

async function createProject() {
  if (!newPrompt.value.trim()) {
    toast.warning('请输入创作提示词')
    return
  }
  creating.value = true
  try {
    const proj = await store.createProject({
      name: newName.value.trim() || undefined,
      prompt: newPrompt.value.trim()
    })
    toast.success('项目已创建，AI 正在生成物料...')
    showCreate.value = false
    newPrompt.value = ''
    newName.value = ''
    router.push(`/projects/${proj.id}`)
  } catch (err) {
    toast.error(err.error || '创建失败，请检查 AI 配置')
  } finally {
    creating.value = false
  }
}

async function deleteProject(id) {
  if (!confirm('确定删除该项目？此操作不可恢复')) return
  try {
    await store.deleteProject(id)
    toast.success('已删除')
  } catch (err) {
    toast.error('删除失败')
  }
}

const statusMap = {
  draft: { label: '草稿', variant: 'default' },
  writing: { label: '写作中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' }
}

const genStatusMap = {
  idle: null,
  generating: { label: '生成中', variant: 'warning' },
  completed: { label: '已生成', variant: 'success' },
  failed: { label: '生成失败', variant: 'danger' }
}
</script>

<template>
  <div class="page-container">
    <div class="flex items-center justify-between" style="margin-bottom: 24px">
      <h1 class="page-title" style="margin-bottom:0">我的项目</h1>
      <VButton variant="primary" @click="showCreate = true">新建项目</VButton>
    </div>

    <VLoading v-if="store.loading" text="加载中..." />

    <div v-else-if="store.projects.length" class="project-grid">
      <VCard v-for="proj in store.projects" :key="proj.id" hoverable>
        <div class="project-item" @click="router.push(`/projects/${proj.id}`)">
          <div class="project-item__top">
            <h3 class="project-item__name">{{ proj.name }}</h3>
            <VDropdown
              :items="[{ label: '删除', value: 'delete', danger: true }]"
              @select="deleteProject(proj.id)"
            >
              <template #trigger>
                <button class="project-item__more" @click.stop>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
                  </svg>
                </button>
              </template>
            </VDropdown>
          </div>
          <p v-if="proj.initial_prompt" class="project-item__prompt">{{ proj.initial_prompt }}</p>
          <div class="project-item__bottom">
            <div class="flex gap-2">
              <VBadge :variant="statusMap[proj.status]?.variant || 'default'">
                {{ statusMap[proj.status]?.label || proj.status }}
              </VBadge>
              <VBadge v-if="genStatusMap[proj.generation_status]" :variant="genStatusMap[proj.generation_status].variant">
                {{ genStatusMap[proj.generation_status].label }}
              </VBadge>
            </div>
            <span class="project-item__date">
              {{ new Date(proj.updated_at).toLocaleDateString('zh-CN') }}
            </span>
          </div>
        </div>
      </VCard>
    </div>

    <div v-else class="empty">
      <p>还没有项目，输入一段创意开始创作</p>
      <VButton variant="primary" @click="showCreate = true">创建第一个项目</VButton>
    </div>

    <VModal v-model="showCreate" title="创建新项目" width="560px">
      <div class="create-form">
        <VTextarea
          v-model="newPrompt"
          label="创作提示词"
          placeholder="描述你想写的小说，例如：&#10;写一本都市修仙小说，主角是一个程序员意外获得修仙传承，在现代都市中一边写代码一边修炼。风格要轻松搞笑，有金手指但不无脑。主角性格腹黑但重感情..."
          :rows="6"
        />
        <VInput
          v-model="newName"
          label="项目名称（可选）"
          placeholder="留空则由 AI 自动生成书名"
        />
        <p class="create-hint">AI 将根据你的提示词自动生成完整的小说策划：世界观、角色、剧情大纲、人物关系等</p>
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showCreate = false">取消</VButton>
        <VButton variant="primary" :loading="creating" @click="createProject">
          创建并生成
        </VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.project-item {
  cursor: pointer;
}

.project-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.project-item__name {
  font-size: 15px;
  font-weight: 600;
}

.project-item__prompt {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-item__more {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
}

.project-item__more:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.project-item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-item__date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.create-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}
</style>
