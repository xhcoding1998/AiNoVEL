<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
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
import VConfirmModal from '../ui/VConfirmModal.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()
const pid = route.params.id
const dataVersion = inject('dataVersion', ref(0))
const isGenerating = inject('isParentGenerating', ref(false))
watch(dataVersion, () => loadData())

const showEditor = ref(false)
const saving = ref(false)
const aiGeneratingChapter = ref(false)
const selectedVolume = ref(null)
const volDetailOpen = ref(false)
const generatingChapters = ref(false)
const generatingChaptersTaskId = ref(null)
const generatingContentMap = ref({})
const pollTimers = ref({})

const showVolEditor = ref(false)
const savingVol = ref(false)
const aiGeneratingVol = ref(false)
const volForm = ref(emptyVolForm())

const confirmDelete = ref({ show: false, type: '', target: null, deleting: false })

function emptyVolForm() {
  return { id: null, volume_number: (store.volumes.length || 0) + 1, title: '', goal: '', summary: '' }
}

const STORAGE_KEY = `ai_chapter_tasks_${pid}`

function persistTasks() {
  const data = {}
  if (generatingChaptersTaskId.value) {
    data._vol = { taskId: generatingChaptersTaskId.value, volumeId: selectedVolume.value }
  }
  for (const [chId, taskId] of Object.entries(generatingContentMap.value)) {
    data[chId] = taskId
  }
  if (Object.keys(data).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function loadPersistedTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearTaskPersistence(key) {
  const data = loadPersistedTasks() || {}
  delete data[key]
  if (Object.keys(data).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const chapterForm = ref({ id: null, volume_id: null, chapter_number: 1, title: '', content: '', status: 'draft' })

const statusOptions = [
  { label: '草稿', value: 'draft' }, { label: '写作中', value: 'writing' },
  { label: '已完成', value: 'completed' }, { label: '已修订', value: 'revised' }
]
const statusVariantMap = { draft: 'default', writing: 'info', completed: 'success', revised: 'purple' }

const currentVolume = computed(() => {
  return store.volumes.find(v => v.id === selectedVolume.value)
})

function isChapterGenerating(chId) {
  return !!generatingContentMap.value[chId]
}

const hasAnyGenerating = computed(() => {
  return generatingChapters.value || Object.keys(generatingContentMap.value).length > 0
})

async function loadData() {
  await store.fetchVolumes(pid)
  if (store.volumes.length) {
    if (!selectedVolume.value) selectedVolume.value = store.volumes[0].id
    await store.fetchChapters(pid, selectedVolume.value)
  }
}

async function restoreRunningTasks() {
  const persisted = loadPersistedTasks()
  if (!persisted) return

  if (persisted._vol) {
    const { taskId, volumeId } = persisted._vol
    try {
      const res = await aiApi.getTask(pid, taskId)
      if (res.data.status === 'running') {
        generatingChapters.value = true
        generatingChaptersTaskId.value = taskId
        if (volumeId) selectedVolume.value = volumeId
        pollChapterOutlines(taskId)
      } else {
        clearTaskPersistence('_vol')
        if (res.data.status === 'completed') {
          await store.fetchChapters(pid, selectedVolume.value)
        }
      }
    } catch {
      clearTaskPersistence('_vol')
    }
  }

  for (const [chId, taskId] of Object.entries(persisted)) {
    if (chId === '_vol') continue
    try {
      const res = await aiApi.getTask(pid, taskId)
      if (res.data.status === 'running') {
        generatingContentMap.value[chId] = taskId
        pollChapterContent(taskId, Number(chId))
      } else {
        clearTaskPersistence(chId)
        if (res.data.status === 'completed') {
          await store.fetchChapters(pid, selectedVolume.value)
        }
      }
    } catch {
      clearTaskPersistence(chId)
    }
  }
}

onMounted(async () => {
  await loadData()
  await restoreRunningTasks()
})

onUnmounted(() => {
  for (const timer of Object.values(pollTimers.value)) {
    clearInterval(timer)
  }
})

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

async function aiFillChapter() {
  if (!selectedVolume.value || !currentVolume.value) {
    toast.warning('请先选择分卷')
    return
  }
  aiGeneratingChapter.value = true
  try {
    const volumeChapters = store.chapters
      .filter(ch => ch.volume_id === selectedVolume.value)
      .sort((a, b) => a.chapter_number - b.chapter_number)

    const existsTitles = volumeChapters
      .filter(ch => ch.id !== chapterForm.value.id)
      .map(ch => ch.title)
      .filter(Boolean)

    const baseNumber = chapterForm.value.chapter_number || (volumeChapters.length || 0) + 1

    const hintParts = []
    hintParts.push(`当前为第${currentVolume.value.volume_number}卷「${currentVolume.value.title || ''}」`)
    if (currentVolume.value.summary) {
      hintParts.push(`本卷概要：${currentVolume.value.summary.slice(0, 120)}`)
    }
    if (volumeChapters.length) {
      hintParts.push(
        '本卷已有章节（部分）：' +
        volumeChapters.slice(0, 10).map(ch =>
          `第${ch.chapter_number}章「${ch.title || '无标题'}」`
        ).join('，')
      )
    }
    if (existsTitles.length) {
      hintParts.push(
        `新章节标题必须与以下标题完全不同：${existsTitles.join('、')}`
      )
    }
    hintParts.push(`请为第${baseNumber}章生成单章大纲，只返回结构化大纲，不要正文内容。`)

    const hint = hintParts.join('\n')

    const res = await aiApi.generateSingleItem(pid, 'chapter', hint)
    const data = res.data || res

    if (data.chapter_number) {
      chapterForm.value.chapter_number = data.chapter_number
    }
    if (data.title) {
      chapterForm.value.title = data.title
    }

    const outlinePieces = []
    if (data.outline) outlinePieces.push(data.outline)
    if (data.key_scenes) outlinePieces.push(`【关键场景】${data.key_scenes}`)
    if (outlinePieces.length) {
      chapterForm.value.content = outlinePieces.join('\n')
      if (!chapterForm.value.status) {
        chapterForm.value.status = 'draft'
      }
    }

    toast.success('AI 已生成章节大纲，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiGeneratingChapter.value = false
  }
}

function deleteChapter(ch) {
  confirmDelete.value = { show: true, type: 'chapter', target: ch, deleting: false }
}

async function handleRegen() {
  await regenerateSection(pid, 'volumes', loadData)
}

function openCreateVol() {
  volForm.value = emptyVolForm()
  volForm.value.volume_number = (store.volumes.length || 0) + 1
  showVolEditor.value = true
}

function openEditVol(vol) {
  volForm.value = { ...vol }
  showVolEditor.value = true
}

async function saveVol() {
  if (!volForm.value.title.trim()) { toast.warning('请输入卷标题'); return }
  savingVol.value = true
  try {
    await store.saveVolume(pid, volForm.value)
    toast.success('已保存')
    showVolEditor.value = false
    await loadData()
  } catch { toast.error('保存失败') }
  finally { savingVol.value = false }
}

function deleteVol(vol) {
  confirmDelete.value = { show: true, type: 'volume', target: vol, deleting: false }
}

async function confirmDeleteAction() {
  const { type, target } = confirmDelete.value
  confirmDelete.value.deleting = true
  try {
    if (type === 'volume') {
      await store.deleteVolume(pid, target.id)
      if (selectedVolume.value === target.id) {
        selectedVolume.value = store.volumes.length ? store.volumes[0].id : null
      }
      await loadData()
      toast.success('分卷已删除')
    } else if (type === 'chapter') {
      await store.deleteChapter(pid, target.id)
      toast.success('章节已删除')
    }
    confirmDelete.value.show = false
  } catch {
    toast.error('删除失败')
  } finally {
    confirmDelete.value.deleting = false
  }
}

async function aiFillVol() {
  aiGeneratingVol.value = true
  try {
    const existingVols = store.volumes
      .filter(v => v.id !== volForm.value.id)
      .sort((a, b) => a.volume_number - b.volume_number)

    const existsTitles = existingVols.map(v => v.title).filter(Boolean)
    const volNum = volForm.value.volume_number || (existingVols.length + 1)

    const hintParts = []
    if (existingVols.length) {
      hintParts.push(
        '已有分卷：' +
        existingVols.map(v => `第${v.volume_number}卷「${v.title || '无标题'}」`).join('，')
      )
    }
    if (existsTitles.length) {
      hintParts.push(`新卷标题必须与以下标题完全不同：${existsTitles.join('、')}`)
    }
    hintParts.push(`请为第${volNum}卷生成分卷大纲，严格承接已有分卷的剧情发展。`)

    const hint = hintParts.join('\n')
    const res = await aiApi.generateSingleItem(pid, 'volume', hint)
    const data = res.data || res

    if (data.volume_number) volForm.value.volume_number = data.volume_number
    if (data.title) volForm.value.title = data.title
    if (data.goal) volForm.value.goal = data.goal
    if (data.summary) volForm.value.summary = data.summary

    toast.success('AI 已生成分卷大纲，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiGeneratingVol.value = false
  }
}

function pollChapterOutlines(taskId) {
  const key = `vol_${taskId}`
  if (pollTimers.value[key]) clearInterval(pollTimers.value[key])
  pollTimers.value[key] = setInterval(async () => {
    try {
      const res = await aiApi.getTask(pid, taskId)
      if (res.data.status === 'completed') {
        clearInterval(pollTimers.value[key])
        delete pollTimers.value[key]
        generatingChapters.value = false
        generatingChaptersTaskId.value = null
        clearTaskPersistence('_vol')
        toast.success('章节大纲生成完成')
        await store.fetchChapters(pid, selectedVolume.value)
      } else if (res.data.status === 'failed') {
        clearInterval(pollTimers.value[key])
        delete pollTimers.value[key]
        generatingChapters.value = false
        generatingChaptersTaskId.value = null
        clearTaskPersistence('_vol')
        toast.error('大纲生成失败: ' + (res.data.result || '未知错误'))
      }
    } catch { /* continue polling */ }
  }, 3000)
}

function pollChapterContent(taskId, chapterId) {
  const key = `ch_${chapterId}`
  if (pollTimers.value[key]) clearInterval(pollTimers.value[key])
  pollTimers.value[key] = setInterval(async () => {
    try {
      const res = await aiApi.getTask(pid, taskId)
      if (res.data.status === 'completed') {
        clearInterval(pollTimers.value[key])
        delete pollTimers.value[key]
        delete generatingContentMap.value[chapterId]
        clearTaskPersistence(String(chapterId))
        toast.success('正文生成完成')
        await store.fetchChapters(pid, selectedVolume.value)
      } else if (res.data.status === 'failed') {
        clearInterval(pollTimers.value[key])
        delete pollTimers.value[key]
        delete generatingContentMap.value[chapterId]
        clearTaskPersistence(String(chapterId))
        toast.error('正文生成失败: ' + (res.data.result || '未知错误'))
      }
    } catch { /* continue polling */ }
  }, 3000)
}

async function generateChaptersForVolume() {
  if (!selectedVolume.value) return
  generatingChapters.value = true
  try {
    const task = await aiApi.generateVolumeChapters(pid, selectedVolume.value, regenPrompt.value.trim() || undefined)
    generatingChaptersTaskId.value = task.data.id
    persistTasks()
    toast.info('AI 正在生成章节大纲，可以离开页面稍后回来查看')
    pollChapterOutlines(task.data.id)
  } catch (err) {
    generatingChapters.value = false
    toast.error(err?.error || '生成失败')
  }
}

async function generateContent(ch) {
  generatingContentMap.value[ch.id] = true
  try {
    const task = await aiApi.generateChapterContent(pid, ch.id)
    generatingContentMap.value[ch.id] = task.data.id
    persistTasks()
    toast.info(`正在生成「${ch.title}」正文，可以继续其他操作`)
    pollChapterContent(task.data.id, ch.id)
  } catch (err) {
    delete generatingContentMap.value[ch.id]
    toast.error(err?.error || '生成失败')
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
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating" :disabled="isGenerating">
          AI 重新生成卷
        </VButton>
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
          <div class="vol-tab__main">
            <span class="vol-tab__num">第{{ vol.volume_number }}卷</span>
            <span v-if="vol.title" class="vol-tab__title">{{ vol.title.replace(/^第[^：:]+[：:]/, '') }}</span>
          </div>
          <div class="vol-tab__ops" v-if="selectedVolume === vol.id">
            <button class="vol-tab__op" @click.stop="openEditVol(vol)" title="编辑卷">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8.5 2.5l3 3M2 9l6-6 3 3-6 6H2V9z" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="vol-tab__op vol-tab__op--del" @click.stop="deleteVol(vol)" title="删除卷">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
            </button>
          </div>
        </button>
        <button class="vol-tab vol-tab--add" @click="openCreateVol">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 2v10M2 7h10" stroke-linecap="round"/>
          </svg>
          <span>添加卷</span>
        </button>
      </div>

      <VCard v-if="currentVolume" class="vol-detail vol-detail--collapsible">
        <div class="vol-detail__head" @click="volDetailOpen = !volDetailOpen">
          <div class="vol-detail__head-left">
            <svg class="vol-detail__chevron" :class="{ 'vol-detail__chevron--open': volDetailOpen }" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h4 class="vol-detail__title">{{ currentVolume.title }}</h4>
            <span class="vol-detail__summary-label">{{ volDetailOpen ? '收起' : '展开' }}本卷描述</span>
          </div>
          <VButton
            variant="primary"
            size="sm"
            :loading="generatingChapters"
            @click.stop="generateChaptersForVolume"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M7 2l1 2.5 2.5.5-2 2 .5 2.5L7 8.5 4.5 9.5l.5-2.5-2-2L5.5 4.5z" stroke-linejoin="round"/>
            </svg>
            AI 生成本卷章节
          </VButton>
        </div>
        <Transition name="vol-detail-fold">
          <div v-show="volDetailOpen" class="vol-detail__body">
            <div v-if="currentVolume.goal" class="vol-detail__section vol-detail__section--block">
              <label class="vol-detail__label">本卷目标</label>
              <p class="vol-detail__text">{{ currentVolume.goal }}</p>
            </div>
            <div v-if="currentVolume.summary" class="vol-detail__section vol-detail__section--block">
              <label class="vol-detail__label">内容概要</label>
              <p class="vol-detail__text vol-detail__text--summary">{{ currentVolume.summary }}</p>
            </div>
          </div>
        </Transition>
      </VCard>

      <div v-if="store.chapters.length" class="chapter-list">
        <div class="chapter-list__header">
          <span class="chapter-list__title">章节列表 · {{ store.chapters.length }} 章</span>
          <span class="chapter-list__words">{{ totalWords.toLocaleString() }} 字</span>
        </div>
        <VCard v-for="ch in store.chapters" :key="ch.id" padding="sm" hoverable>
          <div class="chapter-item" :class="{ 'chapter-item--generating': isChapterGenerating(ch.id) }" @click="openEdit(ch)">
            <div class="chapter-item__head">
              <span class="chapter-item__num">第{{ ch.chapter_number }}章</span>
              <span class="chapter-item__title">{{ ch.title || '无标题' }}</span>
              <VBadge v-if="isChapterGenerating(ch.id)" variant="warning">
                <span class="gen-badge">
                  <span class="gen-badge__dot" />
                  生成中
                </span>
              </VBadge>
              <VBadge v-else :variant="statusVariantMap[ch.status] || 'default'">
                {{ statusOptions.find(s => s.value === ch.status)?.label || ch.status }}
              </VBadge>
            </div>
            <div class="chapter-item__bottom">
              <span v-if="isChapterGenerating(ch.id)" class="chapter-item__gen-hint">AI 正在撰写正文，可离开页面稍后查看</span>
              <span v-else-if="ch.word_count" class="chapter-item__meta">{{ ch.word_count.toLocaleString() }} 字</span>
              <span v-else />
              <div class="chapter-item__actions" :class="{ 'chapter-item__actions--visible': isChapterGenerating(ch.id) }">
                <VButton
                  v-if="isOutlineOnly(ch) && !isChapterGenerating(ch.id)"
                  variant="ghost"
                  size="sm"
                  :disabled="hasAnyGenerating"
                  @click.stop="generateContent(ch)"
                >
                  AI 写正文
                </VButton>
                <VButton
                  v-if="isChapterGenerating(ch.id)"
                  variant="ghost"
                  size="sm"
                  loading
                  disabled
                >
                  生成中...
                </VButton>
                <button v-if="!isChapterGenerating(ch.id)" class="chapter-item__edit" @click.stop="openEdit(ch)" title="编辑">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
                    <path d="M8.5 2.5l3 3M2 9l6-6 3 3-6 6H2V9z" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button v-if="!isChapterGenerating(ch.id)" class="chapter-item__del" @click.stop="deleteChapter(ch)" title="删除">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </VCard>
      </div>
      <p v-else class="empty-hint">本卷暂无章节，点击「AI 生成本卷章节」自动创建章节大纲</p>

      <div class="add-chapter-bar" v-if="selectedVolume">
        <VButton variant="secondary" size="sm" @click="openCreate">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 2v10M2 7h10" stroke-linecap="round"/>
          </svg>
          添加章节
        </VButton>
      </div>
    </template>

    <VModal v-model="showEditor" :title="chapterForm.id ? '编辑章节' : '添加章节'" width="780px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model.number="chapterForm.chapter_number" label="章节号" type="number" />
          <VInput v-model="chapterForm.title" label="章节标题" placeholder="章节标题" />
        </div>
        <VSelect v-model="chapterForm.status" label="状态" :options="statusOptions" />
        <VTextarea v-model="chapterForm.content" label="章节内容" placeholder="在此编写章节内容..." :rows="12" :maxHeight="420" noResize />
      </div>
      <template #footer>
        <div class="modal-footer-full">
          <VButton
            variant="ghost"
            size="sm"
            :loading="aiGeneratingChapter"
            :disabled="isGenerating || aiGeneratingChapter"
            @click="aiFillChapter"
            class="ai-fill-btn"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
            </svg>
            AI 智能填充
          </VButton>
          <div class="modal-footer-right">
            <VButton variant="secondary" @click="showEditor = false">取消</VButton>
            <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="saveChapter">保存</VButton>
          </div>
        </div>
      </template>
    </VModal>

    <VModal v-model="showVolEditor" :title="volForm.id ? '编辑分卷' : '添加分卷'" width="600px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model.number="volForm.volume_number" label="卷号" type="number" />
          <VInput v-model="volForm.title" label="卷标题" placeholder="如：第一卷：风起云涌" />
        </div>
        <VTextarea v-model="volForm.goal" label="本卷目标" placeholder="本卷核心目标..." :rows="3" />
        <VTextarea v-model="volForm.summary" label="内容概要" placeholder="详细内容概要..." :rows="5" />
      </div>
      <template #footer>
        <div class="modal-footer-full">
          <VButton
            variant="ghost"
            size="sm"
            :loading="aiGeneratingVol"
            :disabled="isGenerating || aiGeneratingVol"
            @click="aiFillVol"
            class="ai-fill-btn"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
            </svg>
            AI 智能填充
          </VButton>
          <div class="modal-footer-right">
            <VButton variant="secondary" @click="showVolEditor = false">取消</VButton>
            <VButton variant="primary" :loading="savingVol" :disabled="isGenerating" @click="saveVol">保存</VButton>
          </div>
        </div>
      </template>
    </VModal>

    <VConfirmModal
      v-model="confirmDelete.show"
      :title="confirmDelete.type === 'volume' ? '删除分卷' : '删除章节'"
      confirm-text="确认删除"
      :loading="confirmDelete.deleting"
      @confirm="confirmDeleteAction"
      @cancel="confirmDelete.show = false"
    >
      <template v-if="confirmDelete.type === 'volume' && confirmDelete.target">
        <p>即将删除 <strong>「{{ confirmDelete.target.title || '第' + confirmDelete.target.volume_number + '卷' }}」</strong>，该卷下所有章节也将一并删除，此操作不可撤销。</p>
        <p style="margin-top:8px">删除分卷会导致小说结构出现断层，可能影响后续剧情的连贯性，建议在删除前确认已备份相关内容。</p>
      </template>
      <template v-else-if="confirmDelete.type === 'chapter' && confirmDelete.target">
        <p>即将删除 <strong>「{{ confirmDelete.target.title || '第' + confirmDelete.target.chapter_number + '章' }}」</strong>，此操作不可撤销。</p>
        <p style="margin-top:8px">删除章节可能破坏剧情连贯性，若该章节包含重要伏笔或情节转折，建议先确认对后续章节无影响。</p>
      </template>
    </VConfirmModal>
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

.modal-footer-full {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.modal-footer-right {
  display: flex;
  gap: var(--space-3);
}

.ai-fill-btn {
  color: var(--accent-blue, #0070f3);
}

.ai-fill-btn:hover:not(:disabled) {
  background: var(--accent-blue-subtle, rgba(0, 112, 243, 0.08));
  color: var(--accent-blue, #0070f3);
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
  background: var(--bg-nested);
  border: 1px solid var(--border-default);
  transition: all var(--transition-fast);
  cursor: pointer;
  white-space: nowrap;
  min-width: 100px;
  position: relative;
}

.vol-tab:hover {
  border-color: var(--border-hover);
}

.vol-tab--active {
  border-color: var(--border-hover);
  background: var(--bg-active);
}

.vol-tab--add {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 90px;
  color: var(--text-tertiary);
  border-style: dashed;
  font-size: 12px;
  font-weight: 500;
}

.vol-tab--add:hover {
  color: var(--accent-blue, #0070f3);
  border-color: var(--accent-blue, #0070f3);
  background: var(--accent-blue-subtle, rgba(0, 112, 243, 0.04));
}

.vol-tab__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.vol-tab__ops {
  display: flex;
  gap: 2px;
  position: absolute;
  top: 4px;
  right: 4px;
}

.vol-tab__op {
  padding: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
  line-height: 0;
}

.vol-tab__op:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.vol-tab__op--del:hover {
  color: var(--accent-red, #e53e3e);
  background: rgba(229, 62, 62, 0.08);
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

.vol-detail--collapsible .vol-detail__head {
  cursor: pointer;
  margin-bottom: 0;
  user-select: none;
}

.vol-detail--collapsible .vol-detail__head:hover .vol-detail__chevron {
  color: var(--text-primary);
}

.vol-detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.vol-detail__head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.vol-detail__chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.vol-detail__chevron--open {
  transform: rotate(180deg);
  color: var(--text-secondary);
}

.vol-detail__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vol-detail__summary-label {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.vol-detail__body {
  padding-top: 14px;
}

.vol-detail-fold-enter-active,
.vol-detail-fold-leave-active {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  transform-origin: top;
}

.vol-detail-fold-enter-from,
.vol-detail-fold-leave-to {
  opacity: 0;
  transform: scaleY(0.95);
}

.vol-detail-fold-enter-to,
.vol-detail-fold-leave-from {
  opacity: 1;
  transform: scaleY(1);
}

.vol-detail__section {
  margin-top: 14px;
}

.vol-detail__section--block {
  padding: 12px 14px;
  background: var(--bg-nested);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
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

.chapter-item { cursor: pointer; transition: all var(--transition-fast); }

.chapter-item--generating {
  border-left: 2px solid var(--accent-blue);
  padding-left: 8px;
}

.gen-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.gen-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: gen-pulse 1.2s ease infinite;
}

.chapter-item__gen-hint {
  font-size: 12px;
  color: var(--accent-blue);
  font-style: italic;
}

.chapter-item__actions--visible {
  opacity: 1 !important;
}

@keyframes gen-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

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

.chapter-item__del {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.chapter-item__del:hover {
  color: var(--accent-red, #e53e3e);
  background: rgba(229, 62, 62, 0.08);
}

.form-grid { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; }

.add-chapter-bar {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

.empty-hint {
  color: var(--text-tertiary);
  text-align: center;
  padding: 32px 0;
  font-size: 13px;
}
</style>
