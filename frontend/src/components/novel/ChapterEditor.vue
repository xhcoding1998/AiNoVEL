<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { aiApi } from '../../api/ai'
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
const dataVersion = inject('dataVersion', ref(0))
watch(dataVersion, () => loadData())

const showEditor = ref(false)
const saving = ref(false)
const selectedVolume = ref(null)
const generatingChapters = ref(false)
const generatingContent = ref(null)

const chapterForm = ref({ id: null, volume_id: null, chapter_number: 1, title: '', content: '', status: 'draft' })

const statusOptions = [
  { label: '草稿', value: 'draft' }, { label: '写作中', value: 'writing' },
  { label: '已完成', value: 'completed' }, { label: '已修订', value: 'revised' }
]
const statusVariantMap = { draft: 'default', writing: 'info', completed: 'success', revised: 'purple' }

const currentVolume = computed(() => {
  return store.volumes.find(v => v.id === selectedVolume.value)
})

async function loadData() {
  await store.fetchVolumes(pid)
  if (store.volumes.length) {
    if (!selectedVolume.value) selectedVolume.value = store.volumes[0].id
    await store.fetchChapters(pid, selectedVolume.value)
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

async function deleteChapter(ch) {
  if (!confirm(`确定删除「${ch.title || '第' + ch.chapter_number + '章'}」？`)) return
  try {
    const { novelApi } = await import('../../api/novel')
    // Use the chapters endpoint if available, otherwise manual
    await novelApi.saveChapter(pid, { ...ch, _delete: true })
    toast.success('已删除')
    await store.fetchChapters(pid, selectedVolume.value)
  } catch {
    toast.error('删除失败')
  }
}

async function handleRegen() {
  await regenerateSection(pid, 'volumes', loadData)
}

async function generateChaptersForVolume() {
  if (!selectedVolume.value) return
  generatingChapters.value = true
  try {
    const task = await aiApi.generateVolumeChapters(pid, selectedVolume.value, regenPrompt.value.trim() || undefined)
    toast.success('AI 正在生成章节大纲...')

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2500))
      const res = await aiApi.getTask(pid, task.data.id)
      if (res.data.status === 'completed') {
        toast.success('章节大纲生成完成')
        await store.fetchChapters(pid, selectedVolume.value)
        return
      }
      if (res.data.status === 'failed') {
        toast.error('生成失败: ' + (res.data.result || '未知错误'))
        return
      }
    }
    toast.warning('生成超时，请刷新查看')
  } catch (err) {
    toast.error(err?.error || '生成失败')
  } finally {
    generatingChapters.value = false
  }
}

async function generateContent(ch) {
  generatingContent.value = ch.id
  try {
    const task = await aiApi.generateChapterContent(pid, ch.id)
    toast.success(`正在生成「${ch.title}」正文...`)

    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const res = await aiApi.getTask(pid, task.data.id)
      if (res.data.status === 'completed') {
        toast.success('正文生成完成')
        await store.fetchChapters(pid, selectedVolume.value)
        return
      }
      if (res.data.status === 'failed') {
        toast.error('生成失败: ' + (res.data.result || '未知错误'))
        return
      }
    }
    toast.warning('生成超时')
  } catch (err) {
    toast.error(err?.error || '生成失败')
  } finally {
    generatingContent.value = null
  }
}

function isOutlineOnly(ch) {
  if (!ch.content) return true
  return ch.content.length < 500 && ch.status === 'draft'
}

const totalWords = computed(() => {
  return store.chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0)
})
</script>

<template>
  <div>
    <div class="section-header">
      <div class="section-header__left">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="3" y="2" width="12" height="14" rx="2"/><path d="M6 6h6M6 9h4M6 12h2" stroke-linecap="round"/>
        </svg>
        <h3 class="section-title" style="margin:0">章节管理</h3>
      </div>
      <div class="section-header__actions">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成卷
        </VButton>
        <VButton variant="secondary" size="sm" @click="openCreate" :disabled="!selectedVolume">添加章节</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加更多伏笔章节..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <p v-if="!store.volumes.length" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="4" width="28" height="32" rx="3" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
        <line x1="12" y1="12" x2="28" y2="12" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="18" x2="24" y2="18" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="24" x2="20" y2="24" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>AI 尚未生成分卷大纲，请先在「剧情总控」生成分卷</span>
    </p>

    <template v-else>
      <div class="vol-tabs">
        <button
          v-for="vol in store.volumes"
          :key="vol.id"
          class="vol-tab"
          :class="{ 'vol-tab--active': selectedVolume === vol.id }"
          @click="switchVolume(vol.id)"
        >
          <span class="vol-tab__num">第{{ vol.volume_number }}卷</span>
          <span v-if="vol.title" class="vol-tab__title">{{ vol.title.replace(/^第[^：:]+[：:]/, '') }}</span>
        </button>
      </div>

      <VCard v-if="currentVolume" class="vol-detail">
        <div class="vol-detail__head">
          <h4 class="vol-detail__title">{{ currentVolume.title }}</h4>
          <VButton
            variant="primary"
            size="sm"
            :loading="generatingChapters"
            @click="generateChaptersForVolume"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M7 2l1 2.5 2.5.5-2 2 .5 2.5L7 8.5 4.5 9.5l.5-2.5-2-2L5.5 4.5z" stroke-linejoin="round"/>
            </svg>
            AI 生成本卷章节
          </VButton>
        </div>
        <div v-if="currentVolume.goal" class="vol-detail__section">
          <label class="vol-detail__label">本卷目标</label>
          <p class="vol-detail__text">{{ currentVolume.goal }}</p>
        </div>
        <div v-if="currentVolume.summary" class="vol-detail__section">
          <label class="vol-detail__label">内容概要</label>
          <p class="vol-detail__text vol-detail__text--summary">{{ currentVolume.summary }}</p>
        </div>
      </VCard>

      <div v-if="store.chapters.length" class="chapter-list">
        <div class="chapter-list__header">
          <span class="chapter-list__title">章节列表 · {{ store.chapters.length }} 章</span>
          <span class="chapter-list__words">{{ totalWords.toLocaleString() }} 字</span>
        </div>
        <VCard v-for="ch in store.chapters" :key="ch.id" padding="sm" hoverable>
          <div class="chapter-item">
            <div class="chapter-item__head" @click="openEdit(ch)">
              <span class="chapter-item__num">第{{ ch.chapter_number }}章</span>
              <span class="chapter-item__title">{{ ch.title || '无标题' }}</span>
              <VBadge :variant="statusVariantMap[ch.status] || 'default'">
                {{ statusOptions.find(s => s.value === ch.status)?.label || ch.status }}
              </VBadge>
            </div>
            <div class="chapter-item__bottom">
              <span v-if="ch.word_count" class="chapter-item__meta">{{ ch.word_count.toLocaleString() }} 字</span>
              <div class="chapter-item__actions">
                <VButton
                  v-if="isOutlineOnly(ch)"
                  variant="ghost"
                  size="sm"
                  :loading="generatingContent === ch.id"
                  :disabled="generatingContent !== null && generatingContent !== ch.id"
                  @click.stop="generateContent(ch)"
                >
                  AI 写正文
                </VButton>
                <button class="chapter-item__edit" @click="openEdit(ch)">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
                    <path d="M8.5 2.5l3 3M2 9l6-6 3 3-6 6H2V9z" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </VCard>
      </div>
      <p v-else class="empty-hint">本卷暂无章节，点击「AI 生成本卷章节」自动创建章节大纲</p>
    </template>

    <VModal v-model="showEditor" :title="chapterForm.id ? '编辑章节' : '添加章节'" width="780px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model.number="chapterForm.chapter_number" label="章节号" type="number" />
          <VInput v-model="chapterForm.title" label="章节标题" placeholder="章节标题" />
        </div>
        <VSelect v-model="chapterForm.status" label="状态" :options="statusOptions" />
        <VTextarea v-model="chapterForm.content" label="章节内容" placeholder="在此编写章节内容..." :rows="16" :maxHeight="600" />
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showEditor = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveChapter">保存</VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-header__left svg {
  color: var(--text-tertiary);
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.section-header__actions {
  display: flex;
  gap: 8px;
}

.regen-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-default);
}

.regen-bar .v-input { flex: 1; }

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.vol-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.vol-tabs::-webkit-scrollbar { display: none; }

.vol-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  transition: all var(--transition-fast);
  cursor: pointer;
  white-space: nowrap;
  min-width: 100px;
}

.vol-tab:hover {
  border-color: var(--border-hover);
}

.vol-tab--active {
  border-color: var(--border-hover);
  background: var(--bg-active);
}

.vol-tab__num {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.vol-tab--active .vol-tab__num {
  color: var(--text-primary);
}

.vol-tab__title {
  font-size: 11px;
  color: var(--text-tertiary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vol-detail {
  margin-bottom: 24px;
}

.vol-detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.vol-detail__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.vol-detail__section {
  margin-top: 14px;
}

.vol-detail__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: 6px;
  display: block;
}

.vol-detail__text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.vol-detail__text--summary {
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.chapter-list__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.chapter-list__words {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.chapter-item { cursor: pointer; }

.chapter-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chapter-item__num { font-weight: 600; font-size: 13px; color: var(--text-tertiary); flex-shrink: 0; }
.chapter-item__title { font-weight: 500; font-size: 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chapter-item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.chapter-item__meta { font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); }

.chapter-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.chapter-item:hover .chapter-item__actions { opacity: 1; }

.chapter-item__edit {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.chapter-item__edit:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.form-grid { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; }

.empty-hint {
  color: var(--text-tertiary);
  text-align: center;
  padding: 32px 0;
  font-size: 13px;
}
</style>
