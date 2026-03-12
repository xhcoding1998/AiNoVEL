<script setup>
import { ref, onMounted, onUnmounted, watch, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { useToast } from '../composables/useToast'
import { aiApi } from '../api/ai'
import VTabs from '../components/ui/VTabs.vue'
import VLoading from '../components/ui/VLoading.vue'
import VButton from '../components/ui/VButton.vue'
import VTextarea from '../components/ui/VTextarea.vue'
import GenerationProgress from '../components/GenerationProgress.vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const toast = useToast()

const genStatus = ref('idle')
const genStep = ref(null)
const completedSteps = ref([])
const allSteps = ref([])
const stepLabels = ref({})
const pollTimer = ref(null)
const showRegenModal = ref(false)
const regenPrompt = ref('')
const regenerating = ref(false)

const dataVersion = ref(0)
provide('dataVersion', dataVersion)
provide('refreshParentStatus', () => checkStatus())

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

const isGenerating = computed(() => genStatus.value === 'generating')
const isFailed = computed(() => genStatus.value === 'failed')
const isCompleted = computed(() => genStatus.value === 'completed')
const showProgress = computed(() => genStatus.value !== 'idle')

async function checkStatus() {
  try {
    const res = await aiApi.getGenerationStatus(route.params.id)
    const prevCompleted = completedSteps.value.length
    const prevStatus = genStatus.value

    genStatus.value = res.status
    genStep.value = res.currentStep
    completedSteps.value = res.completedSteps || []
    allSteps.value = res.steps || []
    stepLabels.value = res.stepLabels || {}

    if ((res.completedSteps?.length || 0) > prevCompleted || (res.status === 'completed' && prevStatus !== 'completed')) {
      dataVersion.value++
    }

    if (res.status === 'completed') {
      stopPolling()
      await projectStore.fetchProject(route.params.id)
      toast.success('AI 物料生成完成')
    } else if (res.status === 'failed') {
      stopPolling()
      await projectStore.fetchProject(route.params.id)
    }
  } catch { /* ignore */ }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(checkStatus, 2500)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function handleContinue() {
  try {
    await aiApi.continueGeneration(route.params.id)
    genStatus.value = 'generating'
    startPolling()
    toast.info('正在从断点继续生成...')
  } catch (err) {
    toast.error(err?.error || '继续生成失败，请检查 AI 配置')
  }
}

async function regenerateAll() {
  if (!regenPrompt.value.trim()) {
    toast.warning('请输入创作指令')
    return
  }
  regenerating.value = true
  try {
    await aiApi.generateAll(route.params.id, regenPrompt.value.trim())
    genStatus.value = 'generating'
    showRegenModal.value = false
    regenPrompt.value = ''
    startPolling()
    toast.info('AI 正在重新生成全部物料...')
  } catch (err) {
    toast.error(err?.error || '启动失败')
  } finally {
    regenerating.value = false
  }
}

onMounted(async () => {
  await projectStore.fetchProject(route.params.id)
  await checkStatus()
  if (genStatus.value === 'generating') {
    startPolling()
  }
})

onUnmounted(() => stopPolling())

watch(() => route.params.id, async (id) => {
  if (id) {
    stopPolling()
    await projectStore.fetchProject(id)
    await checkStatus()
    if (genStatus.value === 'generating') startPolling()
  }
})
</script>

<template>
  <div class="page-container">
    <VLoading v-if="projectStore.loading && !projectStore.currentProject" text="加载项目..." />
    <template v-else-if="projectStore.currentProject">
      <div class="detail-header">
        <div class="detail-header__left">
          <button class="back-btn" @click="router.push('/projects')" title="返回项目列表">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M10 3L5 8l5 5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="detail-header__info">
            <h1 class="detail-header__name">{{ projectStore.currentProject.name }}</h1>
            <p v-if="projectStore.currentProject.initial_prompt" class="detail-header__prompt">
              {{ projectStore.currentProject.initial_prompt }}
            </p>
          </div>
        </div>
        <VButton variant="secondary" size="sm" @click="showRegenModal = true" :disabled="isGenerating">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="margin-right: 4px">
            <path d="M1.5 7a5.5 5.5 0 019.81-3.37M12.5 7a5.5 5.5 0 01-9.81 3.37" stroke-linecap="round"/>
            <path d="M11 1v3h-3M3 10v3h3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          全部重新生成
        </VButton>
      </div>

      <GenerationProgress
        v-if="showProgress"
        :status="genStatus"
        :current-step="genStep"
        :completed-steps="completedSteps"
        :steps="allSteps"
        :step-labels="stepLabels"
        @continue="handleContinue"
        @regenerate="showRegenModal = true"
      />

      <VTabs :tabs="tabs" :model-value="currentTab" @update:model-value="switchTab" />

      <div class="project-content">
        <router-view :generation-status="genStatus" />
      </div>

      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showRegenModal" class="modal-overlay" @click.self="showRegenModal = false">
            <Transition name="scale">
              <div v-if="showRegenModal" class="modal-box">
                <h3 class="modal-title">全部重新生成</h3>
                <p class="modal-desc">输入新的创作指令，AI 将分步重新生成全部 7 大类内容，每步完成即可查看</p>
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
            </Transition>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--text-tertiary);
  border-radius: var(--radius-md);
  flex-shrink: 0;
  margin-top: 2px;
  transition: all var(--transition-fast);
  border: 1px solid var(--border-default);
}

.back-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.detail-header__info {
  min-width: 0;
}

.detail-header__name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
  margin-bottom: 4px;
}

.detail-header__prompt {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-content {
  padding-top: 24px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: 24px;
}

.modal-box {
  width: 100%;
  max-width: 500px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--shadow-xl);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: var(--space-2);
}
</style>
