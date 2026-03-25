<script setup>
import { ref, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useProjectStore } from '../../stores/project'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { useCascadeRegenerate } from '../../composables/useCascadeRegenerate'
import VInput from '../ui/VInput.vue'
import VTextarea from '../ui/VTextarea.vue'
import VSelect from '../ui/VSelect.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VAccordionItem from '../ui/VAccordionItem.vue'
import VConfirmModal from '../ui/VConfirmModal.vue'

const route = useRoute()
const store = useNovelStore()
const projectStore = useProjectStore()
const toast = useToast()
const {
  showRegenInput, regenPrompt, regenerating,
  showConfirmModal, affectedSteps,
  requestRegenerate, confirmRegenerate, cancelRegenerate
} = useAIRegenerate()
const {
  showCascadeModal, cascadeAffectedSteps, cascadeStepLabel,
  cascadeLoading, promptCascade, confirmCascade, cancelCascade
} = useCascadeRegenerate()
const dataVersion = inject('dataVersion', ref(0))
const isGenerating = inject('isParentGenerating', ref(false))
watch(dataVersion, () => loadData())

const form = ref({
  book_name: '', genre: '', style: '',
  core_selling_point: '', one_line_summary: '', target_readers: ''
})
const saving = ref(false)
const pid = route.params.id
const openSections = ref({ core_selling_point: false, one_line_summary: false, target_readers: false })

const genreOptions = [
  '都市', '玄幻', '仙侠', '科幻', '悬疑', '言情', '历史', '军事', '游戏', '体育', '灵异', '二次元', '其他'
].map(v => ({ label: v, value: v }))

const styleOptions = [
  '轻松搞笑', '热血爽文', '细腻文艺', '暗黑压抑', '悬疑烧脑', '甜宠', '虐恋', '硬核写实', '其他'
].map(v => ({ label: v, value: v }))

async function loadData() {
  await store.fetchBasicInfo(pid)
  if (store.basicInfo) {
    Object.keys(form.value).forEach(k => {
      if (store.basicInfo[k]) form.value[k] = store.basicInfo[k]
    })
  }
}

onMounted(loadData)

async function save() {
  saving.value = true
  try {
    await store.saveBasicInfo(pid, form.value)
    if (form.value.book_name) {
      await projectStore.fetchProject(pid)
    }
    toast.success('已保存')
    promptCascade(pid, 'basic_info', loadData)
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function handleRegenClick() {
  requestRegenerate(pid, 'basic_info', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <div class="editor-header__left">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 5h6M5 8h4M5 11h2" stroke-linecap="round"/>
          </svg>
          <span>基础信息</span>
        </div>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating" :disabled="isGenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：换成玄幻题材..." />
      <VButton variant="primary" size="sm" :loading="regenerating" :disabled="isGenerating" @click="handleRegenClick">生成</VButton>
    </div>

    <div class="form-grid">
      <VInput v-model="form.book_name" label="书名" placeholder="你的小说名称" />
      <div class="form-row">
        <VSelect v-model="form.genre" label="题材" :options="genreOptions" />
        <VSelect v-model="form.style" label="风格" :options="styleOptions" />
      </div>
      <div class="accordion-list">
        <VAccordionItem title="核心卖点" :open="openSections.core_selling_point" @toggle="openSections.core_selling_point = !openSections.core_selling_point">
          <VTextarea v-model="form.core_selling_point" placeholder="这本书最吸引人的地方是什么？" :rows="4" />
        </VAccordionItem>
        <VAccordionItem title="一句话主线" :open="openSections.one_line_summary" @toggle="openSections.one_line_summary = !openSections.one_line_summary">
          <VTextarea v-model="form.one_line_summary" placeholder="用一句话概括整个故事" :rows="3" />
        </VAccordionItem>
        <VAccordionItem title="目标读者" :open="openSections.target_readers" @toggle="openSections.target_readers = !openSections.target_readers">
          <VTextarea v-model="form.target_readers" placeholder="你的目标读者画像" :rows="3" />
        </VAccordionItem>
      </div>
    </div>
    <template #footer>
      <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="save">保存</VButton>
    </template>
  </VCard>

  <VConfirmModal
    v-model="showConfirmModal"
    title="确认重新生成基础信息"
    confirm-text="确认重新生成"
    :affected-steps="affectedSteps"
    :loading="regenerating"
    @confirm="confirmRegenerate"
    @cancel="cancelRegenerate"
  >
    <p>重新生成「基础信息」将覆盖当前的书名、题材等数据。由于基础信息是整个创作链路的起点，此阶段之后的所有内容都可能需要重新生成以保持一致性。</p>
  </VConfirmModal>

  <VConfirmModal
    v-model="showCascadeModal"
    title="是否重新生成当前内容？"
    confirm-text="重新生成后续"
    cancel-text="跳过"
    confirm-variant="primary"
    :affected-steps="cascadeAffectedSteps"
    :loading="cascadeLoading"
    @confirm="confirmCascade"
    @cancel="cancelCascade"
  >
    <p>你修改了「{{ cascadeStepLabel }}」，是否立即重新生成该部分内容？也可跳过稍后手动处理。</p>
  </VConfirmModal>
</template>

<style scoped>
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.editor-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.editor-header__left svg {
  color: var(--text-tertiary);
}

.regen-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.regen-bar .v-input { flex: 1; }

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.accordion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
