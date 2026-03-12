<script setup>
import { ref, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import VTextarea from '../ui/VTextarea.vue'
import VInput from '../ui/VInput.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VAccordionItem from '../ui/VAccordionItem.vue'
import VConfirmModal from '../ui/VConfirmModal.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const {
  showRegenInput, regenPrompt, regenerating,
  showConfirmModal, affectedSteps,
  requestRegenerate, confirmRegenerate, cancelRegenerate
} = useAIRegenerate()
const pid = route.params.id
const dataVersion = inject('dataVersion', ref(0))
watch(dataVersion, () => loadData())

const form = ref({ writing_style: '', rhythm_requirement: '', romance_ratio: '', taboos: '', red_lines: '' })
const saving = ref(false)
const openSections = ref({ writing_style: false, rhythm_requirement: false, romance_ratio: false, taboos: false, red_lines: false })

async function loadData() {
  await store.fetchWritingStyle(pid)
  if (store.writingStyle) {
    Object.keys(form.value).forEach(k => {
      if (store.writingStyle[k]) form.value[k] = store.writingStyle[k]
    })
  }
}

onMounted(loadData)

async function save() {
  saving.value = true
  try { await store.saveWritingStyle(pid, form.value); toast.success('已保存') }
  catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function handleRegenClick() {
  requestRegenerate(pid, 'writing_style', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <div class="editor-header__left">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M3 13l2-6L12 3l-4 7-5 3z" stroke-linejoin="round"/><circle cx="9" cy="7" r="1"/>
          </svg>
          <span>风格控制</span>
        </div>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：改为更诙谐幽默的风格..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegenClick">生成</VButton>
    </div>

    <div class="accordion-list">
      <VAccordionItem title="文风要求" :open="openSections.writing_style" @toggle="openSections.writing_style = !openSections.writing_style">
        <VTextarea v-model="form.writing_style" placeholder="整体文风描述，如：简洁凌厉、细腻温柔、诙谐幽默..." :rows="3" />
      </VAccordionItem>
      <VAccordionItem title="节奏要求" :open="openSections.rhythm_requirement" @toggle="openSections.rhythm_requirement = !openSections.rhythm_requirement">
        <VTextarea v-model="form.rhythm_requirement" placeholder="章节节奏、爽点频率、松弛有度..." :rows="2" />
      </VAccordionItem>
      <VAccordionItem title="感情线比例" :open="openSections.romance_ratio" @toggle="openSections.romance_ratio = !openSections.romance_ratio">
        <VInput v-model="form.romance_ratio" placeholder="如：30%、主线穿插、独立支线..." />
      </VAccordionItem>
      <VAccordionItem title="禁忌项" :open="openSections.taboos" @toggle="openSections.taboos = !openSections.taboos">
        <VTextarea v-model="form.taboos" placeholder="创作中不能出现的内容或情节..." :rows="2" />
      </VAccordionItem>
      <VAccordionItem title="红线控制" :open="openSections.red_lines" @toggle="openSections.red_lines = !openSections.red_lines">
        <VTextarea v-model="form.red_lines" placeholder="绝对不能触碰的底线..." :rows="2" />
      </VAccordionItem>
    </div>
    <template #footer>
      <VButton variant="primary" :loading="saving" @click="save">保存</VButton>
    </template>
  </VCard>

  <VConfirmModal
    v-model="showConfirmModal"
    title="确认重新生成风格控制"
    confirm-text="确认重新生成"
    :affected-steps="affectedSteps"
    :loading="regenerating"
    @confirm="confirmRegenerate"
    @cancel="cancelRegenerate"
  >
    <p>重新生成「风格控制」将覆盖当前的文风、节奏等设定。作为创作链路的最后一环，重新生成此内容不会影响之前的物料。</p>
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

.accordion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
