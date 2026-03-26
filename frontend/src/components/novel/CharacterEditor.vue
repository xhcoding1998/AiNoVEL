<script setup>
import { ref, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { useCascadeRegenerate } from '../../composables/useCascadeRegenerate'
import { aiApi } from '../../api/ai'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VInput from '../ui/VInput.vue'
import VTextarea from '../ui/VTextarea.vue'
import VSelect from '../ui/VSelect.vue'
import VAvatar from '../ui/VAvatar.vue'
import VBadge from '../ui/VBadge.vue'
import VConfirmModal from '../ui/VConfirmModal.vue'

const route = useRoute()
const store = useNovelStore()
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
const pid = route.params.id
const dataVersion = inject('dataVersion', ref(0))
const isGenerating = inject('isParentGenerating', ref(false))
watch(dataVersion, () => loadData())

// expandedId: 当前展开编辑的角色 id，null 表示无；'new' 表示新建
const expandedId = ref(null)
const saving = ref(false)
const aiGenerating = ref(false)
const editForm = ref(emptyForm())
const confirmDelete = ref({ show: false, target: null, deleting: false })

// 兼容旧逻辑
const showEditor = ref(false)

const roleOptions = [
  { label: '男主', value: 'male_lead' },
  { label: '女主', value: 'female_lead' },
  { label: '配角', value: 'supporting' },
  { label: '反派', value: 'antagonist' },
  { label: '龙套', value: 'minor' }
]

const roleLabelMap = { male_lead: '男主', female_lead: '女主', supporting: '配角', antagonist: '反派', minor: '龙套' }
const roleVariantMap = { male_lead: 'info', female_lead: 'purple', supporting: 'default', antagonist: 'danger', minor: 'warning' }

function emptyForm() {
  return { id: null, name: '', role_type: 'supporting', description: '', core_desire: '', weakness: '', secret: '', image_prompt: '', avatar_color: '#333' }
}

async function loadData() {
  await store.fetchCharacters(pid)
}

onMounted(loadData)

function openCreate() {
  editForm.value = emptyForm()
  expandedId.value = expandedId.value === 'new' ? null : 'new'
}
function openEdit(char) {
  if (expandedId.value === char.id) {
    expandedId.value = null
  } else {
    editForm.value = { ...char }
    expandedId.value = char.id
  }
}
function closeEditor() { expandedId.value = null }

async function saveChar() {
  if (!editForm.value.name.trim()) { toast.warning('请输入角色名'); return }
  saving.value = true
  try {
    await store.saveCharacter(pid, editForm.value)
    toast.success('已保存')
    expandedId.value = null
    promptCascade(pid, 'characters', loadData)
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function deleteChar(char) {
  confirmDelete.value = { show: true, target: char, deleting: false }
}

async function confirmDeleteChar() {
  confirmDelete.value.deleting = true
  try {
    await store.deleteCharacter(pid, confirmDelete.value.target.id)
    toast.success('角色已删除')
    confirmDelete.value.show = false
  } catch { toast.error('删除失败') }
  finally { confirmDelete.value.deleting = false }
}

function handleRegenClick() {
  requestRegenerate(pid, 'characters', loadData)
}

async function aiGenerateChar() {
  aiGenerating.value = true
  try {
    const existingNames = (store.characters || [])
      .filter(c => c.id !== editForm.value.id)
      .map(c => c.name)
      .filter(Boolean)
    const nameWarning = existingNames.length
      ? `\n⚠️ 已有角色：${existingNames.join('、')}。新角色名字必须与以上所有角色不同！`
      : ''

    const form = editForm.value
    const hasAnyInput = form.name?.trim() || form.description?.trim() || form.core_desire?.trim() || form.weakness?.trim() || form.secret?.trim()

    const hint = hasAnyInput
      ? `角色名为「${form.name || '待定'}」，类型为${roleLabelMap[form.role_type] || '配角'}，请基于用户已填写的内容进行补充优化${nameWarning}`
      : `请生成一个${roleLabelMap[form.role_type] || '配角'}类型的角色${nameWarning}`

    const userData = hasAnyInput ? {
      name: form.name?.trim() || '',
      role_type: form.role_type || 'supporting',
      description: form.description?.trim() || '',
      core_desire: form.core_desire?.trim() || '',
      weakness: form.weakness?.trim() || '',
      secret: form.secret?.trim() || ''
    } : undefined

    const res = await aiApi.generateSingleItem(pid, 'character', hint, userData)
    const data = res.data || res

    if (hasAnyInput) {
      editForm.value.name = form.name?.trim() || data.name || editForm.value.name
      editForm.value.role_type = form.role_type || data.role_type || editForm.value.role_type
      editForm.value.description = data.description || form.description || ''
      editForm.value.core_desire = data.core_desire || form.core_desire || ''
      editForm.value.weakness = data.weakness || form.weakness || ''
      editForm.value.secret = data.secret || form.secret || ''
      editForm.value.image_prompt = data.image_prompt || form.image_prompt || ''
    } else {
      editForm.value.name = data.name || editForm.value.name
      editForm.value.role_type = data.role_type || editForm.value.role_type
      editForm.value.description = data.description || ''
      editForm.value.core_desire = data.core_desire || ''
      editForm.value.weakness = data.weakness || ''
      editForm.value.secret = data.secret || ''
      editForm.value.image_prompt = data.image_prompt || ''
    }
    toast.success(hasAnyInput ? 'AI 已基于你的输入补充完善，请检查后保存' : 'AI 已生成角色内容，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiGenerating.value = false
  }
}
</script>

<template>
  <div>
    <div class="section-header">
      <div class="section-header__left">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="9" cy="6" r="3.5"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke-linecap="round"/>
        </svg>
        <h3 class="section-title" style="margin:0">角色设定</h3>
      </div>
      <div class="flex gap-2">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating" :disabled="isGenerating">
          AI 重新生成
        </VButton>
        <VButton variant="primary" size="sm" @click="openCreate">添加角色</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加一个亦正亦邪的角色..." />
      <VButton variant="primary" size="sm" :loading="regenerating" :disabled="isGenerating" @click="handleRegenClick">生成</VButton>
    </div>

    <!-- 新建表单（折叠） -->
    <Transition name="collapse">
      <div v-if="expandedId === 'new'" class="inline-editor inline-editor--new">
        <div class="inline-editor__header">
          <span class="inline-editor__title">新建角色</span>
          <button class="inline-editor__close" @click="closeEditor">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="inline-editor__body">
          <div class="inline-form-grid">
            <div class="inline-form-row">
              <VInput v-model="editForm.name" label="角色名" placeholder="角色名称" />
              <VSelect v-model="editForm.role_type" label="角色类型" :options="roleOptions" />
            </div>
            <VTextarea v-model="editForm.description" label="角色描述" placeholder="外貌、性格、背景简述..." :rows="3" />
            <div class="inline-form-cols">
              <VTextarea v-model="editForm.core_desire" label="核心欲望" placeholder="这个角色最想要什么？" :rows="3" />
              <VTextarea v-model="editForm.weakness" label="弱点" placeholder="性格/能力上的致命弱点" :rows="3" />
            </div>
            <VTextarea v-model="editForm.secret" label="秘密" placeholder="不为人知的秘密" :rows="2" />
            <VTextarea v-model="editForm.image_prompt" label="形象提示词（AI 绘图/视频用）" placeholder="例：25岁男性，面容俊朗清冷，白色汉服僧袍..." :rows="3" />
          </div>
        </div>
        <div class="inline-editor__footer">
          <VButton variant="ghost" size="sm" :loading="aiGenerating" :disabled="isGenerating" @click="aiGenerateChar">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0"><path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/></svg>
            AI 填充
          </VButton>
          <div class="inline-editor__footer-right">
            <VButton variant="secondary" size="sm" @click="closeEditor">取消</VButton>
            <VButton variant="primary" size="sm" :loading="saving" :disabled="isGenerating" @click="saveChar">保存</VButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 角色列表，每个卡片下方可折叠编辑 -->
    <div v-if="store.characters.length" class="char-list">
      <div v-for="char in store.characters" :key="char.id" class="char-item">
        <!-- 卡片头部 -->
        <div class="char-card" :class="{ 'char-card--expanded': expandedId === char.id }" @click="openEdit(char)">
          <div class="char-card__top">
            <VAvatar :name="char.name" :color="char.avatar_color" :size="36" />
            <div class="char-card__info">
              <span class="char-card__name" :title="char.name">{{ char.name }}</span>
              <VBadge :variant="roleVariantMap[char.role_type] || 'default'">
                {{ roleLabelMap[char.role_type] || char.role_type }}
              </VBadge>
            </div>
            <div class="char-card__right">
              <p v-if="char.description" class="char-card__desc-inline">{{ char.description }}</p>
              <div class="char-card__ops">
                <button class="char-card__del" @click.stop="deleteChar(char)" title="删除">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
                </button>
                <svg class="char-card__chevron" width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"
                  :style="{ transform: expandedId === char.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }">
                  <path d="M2 4l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 折叠编辑区 -->
        <Transition name="collapse">
          <div v-if="expandedId === char.id" class="inline-editor">
            <div class="inline-editor__body">
              <div class="inline-form-grid">
                <div class="inline-form-row">
                  <VInput v-model="editForm.name" label="角色名" placeholder="角色名称" />
                  <VSelect v-model="editForm.role_type" label="角色类型" :options="roleOptions" />
                </div>
                <VTextarea v-model="editForm.description" label="角色描述" placeholder="外貌、性格、背景简述..." :rows="3" />
                <div class="inline-form-cols">
                  <VTextarea v-model="editForm.core_desire" label="核心欲望" placeholder="这个角色最想要什么？" :rows="3" />
                  <VTextarea v-model="editForm.weakness" label="弱点" placeholder="性格/能力上的致命弱点" :rows="3" />
                </div>
                <VTextarea v-model="editForm.secret" label="秘密" placeholder="不为人知的秘密" :rows="2" />
                <VTextarea v-model="editForm.image_prompt" label="形象提示词（AI 绘图/视频用）" placeholder="例：25岁男性，面容俊朗清冷，白色汉服僧袍..." :rows="3" />
              </div>
            </div>
            <div class="inline-editor__footer">
              <VButton variant="ghost" size="sm" :loading="aiGenerating" :disabled="isGenerating" @click="aiGenerateChar">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0"><path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/></svg>
                AI 填充
              </VButton>
              <div class="inline-editor__footer-right">
                <VButton variant="secondary" size="sm" @click="closeEditor">取消</VButton>
                <VButton variant="primary" size="sm" :loading="saving" :disabled="isGenerating" @click="saveChar">保存</VButton>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
    <p v-else class="empty-text">AI 尚未生成角色，或点击"添加角色"手动创建</p>

    <VConfirmModal
      v-model="showConfirmModal"
      title="确认重新生成角色设定"
      confirm-text="确认重新生成"
      :affected-steps="affectedSteps"
      :loading="regenerating"
      @confirm="confirmRegenerate"
      @cancel="cancelRegenerate"
    >
      <p>重新生成「角色设定」将覆盖当前所有角色数据，且由于内容链路的依赖关系，此阶段之后的所有内容也可能需要重新生成以保持一致性。</p>
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

    <VConfirmModal
      v-model="confirmDelete.show"
      title="删除角色"
      confirm-text="确认删除"
      :loading="confirmDelete.deleting"
      @confirm="confirmDeleteChar"
      @cancel="confirmDelete.show = false"
    >
      <template v-if="confirmDelete.target">
        <p>即将删除角色 <strong>「{{ confirmDelete.target.name }}」</strong>，此操作不可撤销。</p>
        <p style="margin-top:8px">角色是剧情的核心要素，删除后与该角色相关的人物关系、剧情线索将失去依托，可能影响整体故事连贯性，请谨慎操作。</p>
      </template>
    </VConfirmModal>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: 12px;
}
.section-header__left { display: flex; align-items: center; gap: var(--space-2); }
.section-header__left svg { color: var(--text-tertiary); }

.regen-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}
.regen-bar .v-input { flex: 1; }

/* 角色列表 */
.char-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.char-item {
  border-bottom: 1px solid var(--border-subtle);
}
.char-item:last-child { border-bottom: none; }

.char-card {
  display: flex;
  align-items: stretch;
  cursor: pointer;
  padding: 12px 16px;
  background: var(--bg-secondary);
  transition: background var(--transition-fast);
  user-select: none;
}
.char-card:hover { background: var(--bg-hover); }
.char-card--expanded { background: var(--bg-active); }

.char-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.char-card__info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: 160px;
}

.char-card__name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.char-card__right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.char-card__desc-inline {
  flex: 1;
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.char-card__ops {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.char-card__del {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all var(--transition-fast);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.char-card:hover .char-card__del { opacity: 1; }
.char-card__del:hover { color: var(--accent-red); background: var(--accent-red-subtle); }

.char-card__chevron {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* 折叠编辑区 */
.inline-editor {
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-default);
}

.inline-editor--new {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  overflow: hidden;
}

.inline-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.inline-editor__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.inline-editor__close {
  color: var(--text-tertiary);
  padding: 3px;
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
}
.inline-editor__close:hover { color: var(--text-primary); background: var(--bg-hover); }

.inline-editor__body { padding: 16px; }

.inline-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border-default);
  background: var(--bg-secondary);
}

.inline-editor__footer-right {
  display: flex;
  gap: 8px;
}

.inline-form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.inline-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.inline-form-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  overflow: hidden;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-10); font-size: 14px; }

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
</style>
