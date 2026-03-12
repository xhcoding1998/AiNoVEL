<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import VTextarea from '../ui/VTextarea.vue'
import VInput from '../ui/VInput.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()

const form = ref({ era_setting: '', power_structure: '', rules: '', social_atmosphere: '' })
const saving = ref(false)
const pid = route.params.id

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

async function handleRegen() {
  await regenerateSection(pid, 'world_building', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <span>世界观与背景</span>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：改为未来科幻世界..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <div class="form-grid">
      <VTextarea v-model="form.era_setting" label="时代/城市/行业背景" placeholder="故事发生的时代、地点、行业环境等" :rows="3" />
      <VTextarea v-model="form.power_structure" label="势力结构" placeholder="世界中有哪些主要势力？他们之间的关系如何？" :rows="3" />
      <VTextarea v-model="form.rules" label="规则设定" placeholder="这个世界有哪些特殊规则？修炼体系/科技体系/社会规则等" :rows="3" />
      <VTextarea v-model="form.social_atmosphere" label="社会氛围" placeholder="整体社会风气、民众生活状态等" :rows="3" />
    </div>
    <template #footer>
      <VButton variant="primary" :loading="saving" @click="save">保存</VButton>
    </template>
  </VCard>
</template>

<style scoped>
.editor-header { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.regen-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-default); }
.regen-bar .v-input { flex: 1; }
.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
</style>
