<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { useNovelStore } from '../stores/novel'
import { useToast } from '../composables/useToast'
import { aiApi } from '../api/ai'
import VTabs from '../components/ui/VTabs.vue'
import VLoading from '../components/ui/VLoading.vue'
import VButton from '../components/ui/VButton.vue'
import VCard from '../components/ui/VCard.vue'
import VTextarea from '../components/ui/VTextarea.vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const novelStore = useNovelStore()
const toast = useToast()

const generationStatus = ref('idle')
const pollTimer = ref(null)
const showRegenModal = ref(false)
const regenPrompt = ref('')
const regenerating = ref(false)

const tabs = [
  { label: '基础信息', value: 'basic-info' },
  { label: '世界观', value: 'world-building' },
  { label: '角色设定', value: 'characters' },
  { label: '人物关系', value: 'relations' },
  { label: '剧情总控', value: 'plot' },
  { label: '章节管理', value: 'chapters' },
  { label: '风格控制', value: 'style' },
  { label: 'AI 任务', value: 'ai-tasks' }
]

const currentTab = computed(() => {
  const path = route.path.split('/').pop()
  return tabs.find(t => t.value === path)?.value || 'basic-info'
})

function switchTab(val) {
  router.push(`/projects/${route.params.id}/${val}`)
}

const isGenerating = computed(() => generationStatus.value === 'generating')

async function checkStatus() {
  try {
    const res = await aiApi.getGenerationStatus(route.params.id)
    generationStatus.value = res.status

    if (res.status === 'completed') {
      stopPolling()
      await projectStore.fetchProject(route.params.id)
      toast.success('AI 物料生成完成')
    } else if (res.status === 'failed') {
      stopPolling()
      await projectStore.fetchProject(route.params.id)
      toast.error('AI 生成失败，请检查 AI 配置后重试')
    }
  } catch { /* ignore */ }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(checkStatus, 3000)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function regenerateAll() {
  if (!regenPrompt.value.trim()) {
    toast.warning('请输入新的创作指令')
    return
  }
  regenerating.value = true
  try {
    await aiApi.generateAll(route.params.id, regenPrompt.value.trim())
    generationStatus.value = 'generating'
    showRegenModal.value = false
    regenPrompt.value = ''
    startPolling()
    toast.info('AI 正在重新生成全部物料...')
  } catch (err) {
    toast.error(err.error || '启动失败')
  } finally {
    regenerating.value = false
  }
}

onMounted(async () => {
  await projectStore.fetchProject(route.params.id)
  if (projectStore.currentProject) {
    generationStatus.value = projectStore.currentProject.generation_status || 'idle'
    if (generationStatus.value === 'generating') {
      startPolling()
    }
  }
})

onUnmounted(() => stopPolling())

watch(() => route.params.id, async (id) => {
  if (id) {
    stopPolling()
    await projectStore.fetchProject(id)
    novelStore.clearAll()
    if (projectStore.currentProject) {
      generationStatus.value = projectStore.currentProject.generation_status || 'idle'
      if (generationStatus.value === 'generating') startPolling()
    }
  }
})
</script>

<template>
  <div class="page-container">
    <VLoading v-if="projectStore.loading && !projectStore.currentProject" text="加载项目..." />
    <template v-else-if="projectStore.currentProject">
      <div class="project-header">
        <div class="project-header__left">
          <button class="back-btn" @click="router.push('/projects')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M10 3L5 8l5 5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            返回
          </button>
          <h1 class="page-title" style="margin-bottom:0">{{ projectStore.currentProject.name }}</h1>
        </div>
        <VButton variant="secondary" size="sm" @click="showRegenModal = true" :disabled="isGenerating">
          全部重新生成
        </VButton>
      </div>

      <!-- Generation status banner -->
      <div v-if="isGenerating" class="gen-banner">
        <div class="gen-banner__spinner" />
        <span>AI 正在生成物料，请稍候...</span>
      </div>
      <div v-else-if="generationStatus === 'failed'" class="gen-banner gen-banner--error">
        <span>生成失败，请检查 AI 配置后点击"全部重新生成"重试</span>
      </div>

      <VTabs :tabs="tabs" :model-value="currentTab" @update:model-value="switchTab" />

      <div class="project-content">
        <router-view :generation-status="generationStatus" />
      </div>

      <!-- Regen modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showRegenModal" class="modal-overlay" @click.self="showRegenModal = false">
            <div class="modal-box">
              <h3 class="modal-title">全部重新生成</h3>
              <p class="modal-desc">输入新的创作指令，AI 将基于当前物料重新生成全部 7 大类内容</p>
              <VTextarea
                v-model="regenPrompt"
                placeholder="例如：调整风格为更暗黑的基调，增加一个双面间谍角色..."
                :rows="4"
              />
              <div class="modal-footer">
                <VButton variant="secondary" @click="showRegenModal = false">取消</VButton>
                <VButton variant="primary" :loading="regenerating" @click="regenerateAll">开始生成</VButton>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.project-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: 13px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}

.back-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.project-content {
  padding-top: var(--space-6);
}

.gen-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(0, 112, 243, 0.1);
  border: 1px solid rgba(0, 112, 243, 0.2);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 13px;
  color: var(--accent-blue);
}

.gen-banner--error {
  background: rgba(238, 68, 68, 0.1);
  border-color: rgba(238, 68, 68, 0.2);
  color: var(--accent-red);
}

.gen-banner__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-6);
}

.modal-box {
  width: 100%;
  max-width: 500px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
}

.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
