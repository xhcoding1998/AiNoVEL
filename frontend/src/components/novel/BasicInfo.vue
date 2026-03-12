<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import VInput from '../ui/VInput.vue'
import VTextarea from '../ui/VTextarea.vue'
import VSelect from '../ui/VSelect.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()

const form = ref({
  book_name: '', genre: '', style: '',
  core_selling_point: '', one_line_summary: '', target_readers: ''
})
const saving = ref(false)
const pid = route.params.id

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
    toast.success('已保存')
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function handleRegen() {
  await regenerateSection(pid, 'basic_info', loadData)
}
</script>

<template>
  <VCard>
    <template #header>
      <div class="editor-header">
        <span>基础信息</span>
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
      </div>
    </template>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：换成玄幻题材..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <div class="form-grid">
      <VInput v-model="form.book_name" label="书名" placeholder="你的小说名称" />
      <div class="form-row">
        <VSelect v-model="form.genre" label="题材" :options="genreOptions" />
        <VSelect v-model="form.style" label="风格" :options="styleOptions" />
      </div>
      <VTextarea v-model="form.core_selling_point" label="核心卖点" placeholder="这本书最吸引人的地方是什么？" :rows="2" />
      <VInput v-model="form.one_line_summary" label="一句话主线" placeholder="用一句话概括整个故事" />
      <VTextarea v-model="form.target_readers" label="目标读者" placeholder="你的目标读者画像" :rows="2" />
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
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
</style>
