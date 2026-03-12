import { ref, inject, computed } from 'vue'
import { aiApi } from '../api/ai'
import { useToast } from './useToast'

const GENERATION_STEPS = [
  'basic_info', 'world_building', 'characters', 'relations',
  'plot_control', 'volumes', 'writing_style'
]

const STEP_LABELS = {
  basic_info: '基础信息',
  world_building: '世界观与背景',
  characters: '角色设定',
  relations: '人物关系',
  plot_control: '剧情总控',
  volumes: '分卷大纲',
  writing_style: '风格控制'
}

export function useAIRegenerate() {
  const toast = useToast()
  const showRegenInput = ref(false)
  const regenPrompt = ref('')
  const regenerating = ref(false)
  const refreshParent = inject('refreshParentStatus', null)
  const startParentPolling = inject('startParentPolling', null)

  const showConfirmModal = ref(false)
  const pendingRegenSection = ref(null)
  const pendingRegenCallback = ref(null)
  const pendingProjectId = ref(null)

  function getAffectedSteps(section) {
    const idx = GENERATION_STEPS.indexOf(section)
    if (idx === -1) return []
    return GENERATION_STEPS.slice(idx).map(s => STEP_LABELS[s])
  }

  function getSectionLabel(section) {
    return STEP_LABELS[section] || section
  }

  function requestRegenerate(projectId, section, onComplete) {
    pendingProjectId.value = projectId
    pendingRegenSection.value = section
    pendingRegenCallback.value = onComplete
    showConfirmModal.value = true
  }

  async function confirmRegenerate() {
    showConfirmModal.value = false
    await regenerateSection(
      pendingProjectId.value,
      pendingRegenSection.value,
      pendingRegenCallback.value
    )
  }

  function cancelRegenerate() {
    showConfirmModal.value = false
    pendingRegenSection.value = null
    pendingRegenCallback.value = null
    pendingProjectId.value = null
  }

  const affectedSteps = computed(() =>
    pendingRegenSection.value ? getAffectedSteps(pendingRegenSection.value) : []
  )

  async function regenerateSection(projectId, section, onComplete) {
    regenerating.value = true
    try {
      await aiApi.generateSection(projectId, section, regenPrompt.value.trim() || undefined)
      toast.success('AI 正在重新生成，请稍候...')
      showRegenInput.value = false
      regenPrompt.value = ''

      if (startParentPolling) {
        startParentPolling(onComplete)
      }
    } catch (err) {
      toast.error(err?.error || '生成失败')
      if (refreshParent) refreshParent()
    } finally {
      regenerating.value = false
      pendingRegenSection.value = null
      pendingRegenCallback.value = null
      pendingProjectId.value = null
    }
  }

  return {
    showRegenInput,
    regenPrompt,
    regenerating,
    regenerateSection,
    showConfirmModal,
    pendingRegenSection,
    affectedSteps,
    requestRegenerate,
    confirmRegenerate,
    cancelRegenerate,
    getSectionLabel,
    getAffectedSteps
  }
}
