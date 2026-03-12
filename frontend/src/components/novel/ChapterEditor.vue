<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VInput from '../ui/VInput.vue'
import VTextarea from '../ui/VTextarea.vue'
import VSelect from '../ui/VSelect.vue'
import VModal from '../ui/VModal.vue'
import VBadge from '../ui/VBadge.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()
const pid = route.params.id

const showEditor = ref(false)
const saving = ref(false)
const selectedVolume = ref(null)

const chapterForm = ref({ id: null, volume_id: null, chapter_number: 1, title: '', content: '', status: 'draft' })

const statusOptions = [
  { label: '草稿', value: 'draft' }, { label: '写作中', value: 'writing' },
  { label: '已完成', value: 'completed' }, { label: '已修订', value: 'revised' }
]
const statusVariantMap = { draft: 'default', writing: 'info', completed: 'success', revised: 'purple' }

async function loadData() {
  await store.fetchVolumes(pid)
  if (store.volumes.length) {
    selectedVolume.value = store.volumes[0].id
    await store.fetchChapters(pid, store.volumes[0].id)
  }
}

onMounted(loadData)

async function switchVolume(vid) {
  selectedVolume.value = vid
  await store.fetchChapters(pid, vid)
}

function openCreate() {
  chapterForm.value = { id: null, volume_id: selectedVolume.value, chapter_number: (store.chapters.length || 0) + 1, title: '', content: '', status: 'draft' }
  showEditor.value = true
}

function openEdit(ch) { chapterForm.value = { ...ch }; showEditor.value = true }

async function saveChapter() {
  saving.value = true
  try { await store.saveChapter(pid, chapterForm.value); toast.success('已保存'); showEditor.value = false }
  catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function handleRegen() {
  await regenerateSection(pid, 'volumes', loadData)
}
</script>

<template>
  <div>
    <div class="chapter-header">
      <h3 class="section-title" style="margin:0">章节管理</h3>
      <div class="flex gap-2">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成卷
        </VButton>
        <VButton v-for="vol in store.volumes" :key="vol.id" :variant="selectedVolume === vol.id ? 'primary' : 'secondary'" size="sm" @click="switchVolume(vol.id)">
          第{{ vol.volume_number }}卷
        </VButton>
        <VButton variant="secondary" size="sm" @click="openCreate" :disabled="!selectedVolume">添加章节</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加更多伏笔章节..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <p v-if="!store.volumes.length" class="empty-text">AI 尚未生成分卷大纲</p>

    <div v-else-if="store.chapters.length" class="chapter-list">
      <VCard v-for="ch in store.chapters" :key="ch.id" padding="sm" hoverable>
        <div class="chapter-item" @click="openEdit(ch)">
          <div class="chapter-item__head">
            <span class="chapter-item__num">第{{ ch.chapter_number }}章</span>
            <span class="chapter-item__title">{{ ch.title || '无标题' }}</span>
            <VBadge :variant="statusVariantMap[ch.status] || 'default'">{{ statusOptions.find(s => s.value === ch.status)?.label || ch.status }}</VBadge>
          </div>
          <div class="chapter-item__meta"><span>{{ ch.word_count || 0 }} 字</span></div>
        </div>
      </VCard>
    </div>
    <p v-else class="empty-text">本卷暂无章节</p>

    <VModal v-model="showEditor" :title="chapterForm.id ? '编辑章节' : '添加章节'" width="720px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model.number="chapterForm.chapter_number" label="章节号" type="number" />
          <VInput v-model="chapterForm.title" label="章节标题" placeholder="章节标题" />
        </div>
        <VSelect v-model="chapterForm.status" label="状态" :options="statusOptions" />
        <VTextarea v-model="chapterForm.content" label="章节内容" placeholder="在此编写章节内容..." :rows="12" />
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showEditor = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveChapter">保存</VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.chapter-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2); }
.regen-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-default); }
.regen-bar .v-input { flex: 1; }
.chapter-list { display: flex; flex-direction: column; gap: var(--space-2); }
.chapter-item { cursor: pointer; }
.chapter-item__head { display: flex; align-items: center; gap: var(--space-2); }
.chapter-item__num { font-weight: 600; font-size: 13px; color: var(--text-secondary); }
.chapter-item__title { font-weight: 500; font-size: 14px; flex: 1; }
.chapter-item__meta { font-size: 12px; color: var(--text-tertiary); margin-top: var(--space-1); }
.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.form-row { display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-4); }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-8); }
</style>
