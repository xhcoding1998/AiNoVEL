import { ref } from 'vue'
import { aiApi } from '../api/ai'
import { useToast } from './useToast'

export function useAIRegenerate() {
  const toast = useToast()
  const showRegenInput = ref(false)
  const regenPrompt = ref('')
  const regenerating = ref(false)

  async function regenerateSection(projectId, section, onComplete) {
    regenerating.value = true
    try {
      await aiApi.generateSection(projectId, section, regenPrompt.value.trim() || undefined)
      toast.success('AI 正在重新生成，请稍候...')
      showRegenInput.value = false
      regenPrompt.value = ''

      // Poll until done
      const maxAttempts = 40
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const res = await aiApi.getGenerationStatus(projectId)
        if (res.status === 'completed') {
          toast.success('重新生成完成')
          if (onComplete) await onComplete()
          return
        }
        if (res.status === 'failed') {
          toast.error('生成失败，请检查 AI 配置')
          return
        }
      }
      toast.warning('生成超时，请刷新页面查看')
    } catch (err) {
      toast.error(err.error || '生成失败')
    } finally {
      regenerating.value = false
    }
  }

  return {
    showRegenInput,
    regenPrompt,
    regenerating,
    regenerateSection
  }
}
