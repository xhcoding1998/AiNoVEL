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
const pid = route.params.id

const form = ref({ writing_style: '', rhythm_requirement: '', romance_ratio: '', taboos: '', red_lines: '' })
const saving = ref(false)

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

async function handleRegen() {
  await regenerateSection(pid, 'writing_style', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <span>风格控制</span>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：改为更诙谐幽默的风格..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <div class="form-grid">
      <VTextarea v-model="form.writing_style" label="文风要求" placeholder="整体文风描述，如：简洁凌厉、细腻温柔、诙谐幽默..." :rows="3" />
      <VTextarea v-model="form.rhythm_requirement" label="节奏要求" placeholder="章节节奏、爽点频率、松弛有度..." :rows="2" />
      <VInput v-model="form.romance_ratio" label="感情线比例" placeholder="如：30%、主线穿插、独立支线..." />
      <VTextarea v-model="form.taboos" label="禁忌项" placeholder="创作中不能出现的内容或情节..." :rows="2" />
      <VTextarea v-model="form.red_lines" label="红线控制" placeholder="绝对不能触碰的底线..." :rows="2" />
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
