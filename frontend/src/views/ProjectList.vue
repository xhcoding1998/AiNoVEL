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
import VConfirmModal from '../components/ui/VConfirmModal.vue'

const router = useRouter()
const store = useProjectStore()
const toast = useToast()

const showCreate = ref(false)
const newPrompt = ref('')
const newName = ref('')
const creating = ref(false)
const showDeleteConfirm = ref(false)
const deletingProjectId = ref(null)
const deleting = ref(false)

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

function requestDeleteProject(id) {
  deletingProjectId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteProject() {
  deleting.value = true
  try {
    await store.deleteProject(deletingProjectId.value)
    toast.success('已删除')
    showDeleteConfirm.value = false
  } catch (err) {
    toast.error('删除失败')
  } finally {
    deleting.value = false
  }
}

const statusMap = {
  draft: { label: '草稿', variant: 'default' },
  writing: { label: '写作中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' }
}

const STEP_LABELS = {
  basic_info: '基础信息',
  world_building: '世界观',
  characters: '角色设定',
  relations: '人物关系',
  plot_control: '剧情总控',
  volumes: '分卷大纲',
  writing_style: '风格控制'
}

function getGenStatus(proj) {
  if (proj.generation_status === 'idle') return null
  if (proj.generation_status === 'generating') {
    const stepName = STEP_LABELS[proj.generation_step] || ''
    return { label: stepName ? `生成中·${stepName}` : '生成中', variant: 'warning' }
  }
  if (proj.generation_status === 'completed') return { label: '已生成', variant: 'success' }
  if (proj.generation_status === 'failed') {
    const stepName = STEP_LABELS[proj.generation_step] || ''
    return { label: stepName ? `${stepName}失败` : '生成失败', variant: 'danger' }
  }
  return null
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom: 4px">我的项目</h1>
        <p class="page-subtitle" style="margin-bottom: 0">管理和创建你的小说项目</p>
      </div>
      <VButton variant="primary" @click="showCreate = true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-right: 6px">
          <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        新建项目
      </VButton>
    </div>

    <VLoading v-if="store.loading" text="加载中..." />

    <div v-else-if="store.projects.length" class="project-grid">
      <VCard v-for="proj in store.projects" :key="proj.id" hoverable>
        <div class="project-item" @click="router.push(`/projects/${proj.id}`)">
          <div class="project-item__top">
            <h3 class="project-item__name">{{ proj.name }}</h3>
            <VDropdown
              :items="[{ label: '删除', value: 'delete', danger: true }]"
              @select="requestDeleteProject(proj.id)"
            >
              <template #trigger>
                <button class="project-item__more">
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
              <VBadge v-if="getGenStatus(proj)" :variant="getGenStatus(proj).variant">
                {{ getGenStatus(proj).label }}
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
      <div class="empty__icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
          <path d="M16 18h16M16 24h12M16 30h8" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="36" cy="36" r="8" fill="var(--accent-blue)" opacity="0.15"/>
          <path d="M36 33v6M33 36h6" stroke="var(--accent-blue)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="empty__text">还没有项目，输入一段创意开始创作</p>
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

    <VConfirmModal
      v-model="showDeleteConfirm"
      title="确认删除项目"
      confirm-text="删除"
      :loading="deleting"
      @confirm="confirmDeleteProject"
      @cancel="showDeleteConfirm = false"
    >
      <p>确定删除该项目吗？所有章节、角色、关系等数据都将被永久删除，此操作不可恢复。</p>
    </VConfirmModal>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.project-item__prompt {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.project-item__more {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  opacity: 0;
}

.project-item:hover .project-item__more {
  opacity: 1;
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
  padding: 80px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.empty__icon {
  margin-bottom: var(--space-2);
}

.empty__text {
  color: var(--text-tertiary);
  font-size: 14px;
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
  padding: var(--space-3);
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}
</style>
