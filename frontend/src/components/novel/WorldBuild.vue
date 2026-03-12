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
const dataVersion = inject('dataVersion', ref(0))
const isGenerating = inject('isParentGenerating', ref(false))
watch(dataVersion, () => loadData())

const form = ref({ era_setting: '', power_structure: '', rules: '', social_atmosphere: '' })
const saving = ref(false)
const pid = route.params.id
const openSections = ref({ era_setting: false, power_structure: false, rules: false, social_atmosphere: false })

async function loadData() {
  await store.fetchWorldBuilding(pid)
  if (store.worldBuilding) {
    Object.keys(form.value).forEach(k => {
      if (store.worldBuilding[k]) form.value[k] = store.worldBuilding[k]
    })
  }
}

onMounted(loadData)

async function save() {
  saving.value = true
  try {
    await store.saveWorldBuilding(pid, form.value)
    toast.success('已保存')
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function handleRegenClick() {
  requestRegenerate(pid, 'world_building', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <div class="editor-header__left">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12" stroke-linecap="round"/>
          </svg>
          <span>世界观与背景</span>
        </div>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating" :disabled="isGenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：改为未来科幻世界..." />
      <VButton variant="primary" size="sm" :loading="regenerating" :disabled="isGenerating" @click="handleRegenClick">生成</VButton>
    </div>

    <div class="accordion-list">
      <VAccordionItem title="时代/城市/行业背景" :open="openSections.era_setting" @toggle="openSections.era_setting = !openSections.era_setting">
        <VTextarea v-model="form.era_setting" placeholder="故事发生的时代、地点、行业环境等" :rows="3" />
      </VAccordionItem>
      <VAccordionItem title="势力结构" :open="openSections.power_structure" @toggle="openSections.power_structure = !openSections.power_structure">
        <VTextarea v-model="form.power_structure" placeholder="世界中有哪些主要势力？他们之间的关系如何？" :rows="3" />
      </VAccordionItem>
      <VAccordionItem title="规则设定" :open="openSections.rules" @toggle="openSections.rules = !openSections.rules">
        <VTextarea v-model="form.rules" placeholder="这个世界有哪些特殊规则？修炼体系/科技体系/社会规则等" :rows="3" />
      </VAccordionItem>
      <VAccordionItem title="社会氛围" :open="openSections.social_atmosphere" @toggle="openSections.social_atmosphere = !openSections.social_atmosphere">
        <VTextarea v-model="form.social_atmosphere" placeholder="整体社会风气、民众生活状态等" :rows="3" />
      </VAccordionItem>
    </div>
    <template #footer>
      <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="save">保存</VButton>
    </template>
  </VCard>

  <VConfirmModal
    v-model="showConfirmModal"
    title="确认重新生成世界观"
    confirm-text="确认重新生成"
    :affected-steps="affectedSteps"
    :loading="regenerating"
    @confirm="confirmRegenerate"
    @cancel="cancelRegenerate"
  >
    <p>重新生成「世界观与背景」将覆盖当前的世界观设定。由于内容链路的依赖关系，此阶段之后的角色、关系、剧情等内容都可能需要重新生成以保持一致性。</p>
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
