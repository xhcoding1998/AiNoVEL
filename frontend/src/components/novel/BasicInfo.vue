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
const artStyle = ref('')
const saving = ref(false)
const pid = route.params.id
const openSections = ref({ core_selling_point: false, one_line_summary: false, target_readers: false })

// 画风预设快选
const ART_STYLE_PRESETS = [
  { label: '3D国漫', value: '3D国风动漫，玉润质感，细腻皮肤，柔和冷调光影，高精度建模，影视级渲染，国风美学' },
  { label: '2D国漫', value: '2D国风动漫，线条流畅，色彩鲜明，水墨晕染，古风美学，高清插画' },
  { label: '日漫', value: '日式动漫风格，精致二次元，清晰线条，鲜明色彩，赛璐璐着色，动漫质感' },
  { label: '真人写实', value: '写实风格，电影质感，8K超清，自然光影，史诗感，摄影级细节' },
  { label: '水墨国画', value: '中国水墨画风，写意笔触，墨色晕染，留白美学，古典意境，宣纸质感' },
  { label: '武侠水墨', value: '武侠水墨风，古风飘逸，墨迹晕染，侠客气质，山水意境，古典东方美学' },
  { label: '赛博朋克', value: '赛博朋克风格，霓虹灯光，科技感，暗色调，未来都市，金属质感，荧光色彩' },
  { label: '奇幻插画', value: '奇幻插画风格，魔法光效，史诗感，精细细节，油画质感，华丽色彩，神秘氛围' },
  { label: '美式漫画', value: '美式漫画风格，粗犷线条，强烈阴影，英雄主义构图，对比强烈，漫画质感' },
  { label: '暗黑奇幻', value: '暗黑奇幻风格，哥特气质，阴暗色调，神秘光效，史诗感，精细细节' },
  { label: '像素风', value: '像素艺术风格，8-bit/16-bit，复古游戏美学，清晰像素块，鲜明色块，怀旧感' },
]


async function loadData() {
  await store.fetchBasicInfo(pid)
  if (store.basicInfo) {
    Object.keys(form.value).forEach(k => {
      if (store.basicInfo[k]) form.value[k] = store.basicInfo[k]
    })
  }
  // 加载项目画风
  await projectStore.fetchProject(pid)
  if (projectStore.currentProject?.art_style) {
    artStyle.value = projectStore.currentProject.art_style
  }
}

onMounted(loadData)

async function save() {
  saving.value = true
  try {
    await store.saveBasicInfo(pid, form.value)
    // 同步保存画风到 project
    await projectStore.updateProject(pid, { art_style: artStyle.value })
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
        <VInput v-model="form.genre" label="题材" placeholder="如：玄幻、都市、仙侠、科幻..." />
        <VInput v-model="form.style" label="叙事风格" placeholder="如：热血爽文、轻松搞笑、暗黑压抑..." />
      </div>

      <!-- 画面风格 -->
      <div class="art-style-section">
        <div class="art-style-header">
          <label class="art-style-label">画面风格</label>
          <span class="art-style-tip">影响角色形象提示词和分镜描述的视觉风格</span>
        </div>
        <!-- 预设快选 -->
        <div class="art-style-presets">
          <button
            v-for="p in ART_STYLE_PRESETS"
            :key="p.value"
            class="art-style-preset-btn"
            :class="{ 'art-style-preset-btn--active': artStyle === p.value }"
            @click="artStyle = p.value"
          >{{ p.label }}</button>
        </div>
        <!-- 自由输入 -->
        <VInput
          v-model="artStyle"
          placeholder="或直接输入自定义画风，如：3D国风动漫，玉润质感，影视级渲染..."
        />
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

/* 画面风格 */
.art-style-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.art-style-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.art-style-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.art-style-tip {
  font-size: 11px;
  color: var(--text-tertiary);
}

.art-style-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.art-style-preset-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 20px;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.art-style-preset-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
.art-style-preset-btn--active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  font-weight: 500;
}
</style>
