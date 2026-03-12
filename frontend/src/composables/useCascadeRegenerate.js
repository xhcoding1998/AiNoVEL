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

export function useCascadeRegenerate() {
  const toast = useToast()
  const startParentPolling = inject('startParentPolling', null)

  const showCascadeModal = ref(false)
  const cascadeStep = ref(null)
  const cascadeProjectId = ref(null)
  const cascadeLoading = ref(false)
  const cascadeCallback = ref(null)

  const cascadeAffectedSteps = computed(() => {
    if (!cascadeStep.value) return []
    const idx = GENERATION_STEPS.indexOf(cascadeStep.value)
    if (idx === -1 || idx >= GENERATION_STEPS.length - 1) return []
    return GENERATION_STEPS.slice(idx + 1).map(s => STEP_LABELS[s])
  })

  const cascadeStepLabel = computed(() => {
    return cascadeStep.value ? STEP_LABELS[cascadeStep.value] || cascadeStep.value : ''
  })

  const hasCascadeSteps = computed(() => cascadeAffectedSteps.value.length > 0)

  /**
   * 保存后调用：如果当前 step 之后还有步骤，弹出确认弹窗
   * @param {string} projectId
   * @param {string} step - 当前编辑的步骤 key
   * @param {Function} [onComplete] - 重新生成完成后的回调
   */
  function promptCascade(projectId, step, onComplete) {
    const idx = GENERATION_STEPS.indexOf(step)
    if (idx === -1 || idx >= GENERATION_STEPS.length - 1) return

    cascadeProjectId.value = projectId
    cascadeStep.value = step
    cascadeCallback.value = onComplete || null
    showCascadeModal.value = true
  }

  async function confirmCascade() {
    cascadeLoading.value = true
    try {
      await aiApi.regenerateFrom(cascadeProjectId.value, cascadeStep.value)
      showCascadeModal.value = false
      toast.info('正在重新生成后续内容...')

      if (startParentPolling) {
        startParentPolling(cascadeCallback.value)
      }
    } catch (err) {
      toast.error(err?.error || '启动级联重新生成失败')
    } finally {
      cascadeLoading.value = false
    }
  }

  function cancelCascade() {
    showCascadeModal.value = false
    cascadeStep.value = null
    cascadeProjectId.value = null
    cascadeCallback.value = null
  }

  return {
    showCascadeModal,
    cascadeAffectedSteps,
    cascadeStepLabel,
    cascadeLoading,
    hasCascadeSteps,
    promptCascade,
    confirmCascade,
    cancelCascade
  }
}
