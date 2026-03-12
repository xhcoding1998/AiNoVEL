<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { aiApi } from '../../api/ai'
import { useToast } from '../../composables/useToast'
import VButton from '../ui/VButton.vue'
import VLoading from '../ui/VLoading.vue'

const route = useRoute()
const toast = useToast()
const pid = route.params.id
const dataVersion = inject('dataVersion', ref(0))

const loading = ref(true)
const previewData = ref(null)
const currentChapter = ref(null)
const sidebarOpen = ref(true)

watch(dataVersion, () => loadPreview())

async function loadPreview() {
  loading.value = true
  try {
    const res = await aiApi.getPreview(pid)
    previewData.value = res.data
    if (!currentChapter.value && res.data.volumes?.length) {
      const firstVol = res.data.volumes.find(v => v.chapters?.length)
      if (firstVol) currentChapter.value = firstVol.chapters[0]
    }
  } catch {
    toast.error('加载预览失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadPreview)

const bookName = computed(() => previewData.value?.basicInfo?.book_name || '未命名小说')

const allChapters = computed(() => {
  if (!previewData.value?.volumes) return []
  const list = []
  for (const vol of previewData.value.volumes) {
    for (const ch of (vol.chapters || [])) {
      list.push({ ...ch, volumeTitle: vol.title, volumeNumber: vol.volume_number })
    }
  }
  return list
})

const totalWords = computed(() => allChapters.value.reduce((sum, ch) => sum + (ch.word_count || 0), 0))

function selectChapter(ch) {
  currentChapter.value = ch
  if (window.innerWidth < 768) sidebarOpen.value = false
}

function nextChapter() {
  const idx = allChapters.value.findIndex(c => c.id === currentChapter.value?.id)
  if (idx >= 0 && idx < allChapters.value.length - 1) {
    currentChapter.value = allChapters.value[idx + 1]
    scrollToTop()
  }
}

function prevChapter() {
  const idx = allChapters.value.findIndex(c => c.id === currentChapter.value?.id)
  if (idx > 0) {
    currentChapter.value = allChapters.value[idx - 1]
    scrollToTop()
  }
}

function scrollToTop() {
  const el = document.querySelector('.preview-content')
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
}

const currentIdx = computed(() => allChapters.value.findIndex(c => c.id === currentChapter.value?.id))
const hasPrev = computed(() => currentIdx.value > 0)
const hasNext = computed(() => currentIdx.value >= 0 && currentIdx.value < allChapters.value.length - 1)

const formattedContent = computed(() => {
  if (!currentChapter.value?.content) return ''
  return currentChapter.value.content
    .split(/\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim()}</p>`)
    .join('')
})
</script>

<template>
  <div class="preview-wrapper">
    <VLoading v-if="loading" text="加载中..." />
    <template v-else-if="previewData">
      <div v-if="!allChapters.length" class="preview-empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="32" height="40" rx="4" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
          <path d="M16 16h16M16 22h12M16 28h8" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <h3 class="preview-empty__title">尚无章节内容</h3>
        <p class="preview-empty__desc">请先在「章节管理」中生成章节大纲并写入正文</p>
      </div>

      <div v-else class="preview-layout" :class="{ 'preview-layout--collapsed': !sidebarOpen }">
        <aside class="preview-toc" :class="{ 'preview-toc--open': sidebarOpen }">
          <div class="preview-toc__header">
            <h3 class="preview-toc__book">{{ bookName }}</h3>
            <span class="preview-toc__meta">{{ allChapters.length }} 章 · {{ totalWords.toLocaleString() }} 字</span>
          </div>
          <nav class="preview-toc__nav">
            <template v-for="vol in previewData.volumes" :key="vol.id">
              <div v-if="vol.chapters?.length" class="preview-toc__volume">
                第{{ vol.volume_number }}卷 {{ vol.title?.replace(/^第[^：:]+[：:]/, '') || '' }}
              </div>
              <button
                v-for="ch in vol.chapters"
                :key="ch.id"
                class="preview-toc__item"
                :class="{ 'preview-toc__item--active': currentChapter?.id === ch.id }"
                @click="selectChapter({ ...ch, volumeTitle: vol.title, volumeNumber: vol.volume_number })"
              >
                <span class="preview-toc__ch-num">{{ ch.chapter_number }}</span>
                <span class="preview-toc__ch-title">{{ ch.title || '无标题' }}</span>
              </button>
            </template>
          </nav>
        </aside>

        <main class="preview-content">
          <div class="preview-toolbar">
            <button class="preview-toggle" @click="sidebarOpen = !sidebarOpen">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 5h12M3 9h12M3 13h12" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="preview-location">第{{ currentChapter?.volumeNumber }}卷 · 第{{ currentChapter?.chapter_number }}章</span>
          </div>

          <article class="preview-article">
            <h1 class="preview-article__title">{{ currentChapter?.title }}</h1>
            <div
              v-if="currentChapter?.content && currentChapter.content.length > 200"
              class="preview-article__body"
              v-html="formattedContent"
            />
            <div v-else class="preview-article__outline">
              <p class="preview-article__notice">本章尚未生成正文，以下为章节大纲：</p>
              <p class="preview-article__outline-text">{{ currentChapter?.content || '暂无内容' }}</p>
            </div>
          </article>

          <div class="preview-nav">
            <VButton variant="secondary" size="sm" :disabled="!hasPrev" @click="prevChapter">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 3L4 7l4 4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              上一章
            </VButton>
            <span class="preview-nav__progress">{{ currentIdx + 1 }} / {{ allChapters.length }}</span>
            <VButton variant="secondary" size="sm" :disabled="!hasNext" @click="nextChapter">
              下一章
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </VButton>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
.preview-wrapper {
  margin: -32px -24px;
  min-height: calc(100vh - 100px);
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  gap: 12px;
}

.preview-empty__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.preview-empty__desc {
  font-size: 14px;
  color: var(--text-tertiary);
}

.preview-layout {
  display: flex;
  min-height: calc(100vh - 100px);
}

.preview-toc {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-default);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--transition-normal), opacity var(--transition-normal);
}

.preview-layout--collapsed .preview-toc {
  width: 0;
  opacity: 0;
  border-right: none;
}

.preview-toc__header {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border-default);
}

.preview-toc__book {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}

.preview-toc__meta {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.preview-toc__nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.preview-toc__volume {
  padding: 12px 8px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.preview-toc__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  text-align: left;
}

.preview-toc__item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.preview-toc__item--active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.preview-toc__ch-num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 20px;
  text-align: right;
  flex-shrink: 0;
}

.preview-toc__ch-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100vh - 100px);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.preview-toggle {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.preview-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.preview-location {
  font-size: 12px;
  color: var(--text-tertiary);
}

.preview-article {
  flex: 1;
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 24px 60px;
  width: 100%;
}

.preview-article__title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 32px;
  color: var(--text-primary);
  line-height: 1.3;
}

.preview-article__body {
  font-size: 16px;
  line-height: 1.9;
  color: var(--text-primary);
}

.preview-article__body :deep(p) {
  text-indent: 2em;
  margin-bottom: 0.8em;
}

.preview-article__outline {
  padding: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.preview-article__notice {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  font-weight: 500;
}

.preview-article__outline-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
}

.preview-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}

.preview-nav__progress {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

@media (max-width: 768px) {
  .preview-toc {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 200;
    box-shadow: var(--shadow-xl);
  }

  .preview-layout--collapsed .preview-toc {
    transform: translateX(-100%);
  }
}
</style>
