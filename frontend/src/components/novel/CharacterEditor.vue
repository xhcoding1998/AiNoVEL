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
import VDrawer from '../ui/VDrawer.vue'
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

const showEditor = ref(false)
const saving = ref(false)
const aiGenerating = ref(false)
const editForm = ref(emptyForm())
const confirmDelete = ref({ show: false, target: null, deleting: false })

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

function openCreate() { editForm.value = emptyForm(); showEditor.value = true }
function openEdit(char) { editForm.value = { ...char }; showEditor.value = true }

async function saveChar() {
  if (!editForm.value.name.trim()) { toast.warning('请输入角色名'); return }
  saving.value = true
  try {
    await store.saveCharacter(pid, editForm.value)
    toast.success('已保存')
    showEditor.value = false
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

    <div v-if="store.characters.length" class="char-grid">
      <VCard v-for="char in store.characters" :key="char.id" hoverable padding="sm">
        <div class="char-card" @click="openEdit(char)">
          <div class="char-card__top">
            <VAvatar :name="char.name" :color="char.avatar_color" :size="38" />
            <div class="char-card__info">
              <span class="char-card__name" :title="char.name">{{ char.name }}</span>
              <span class="char-card__badge">
                <VBadge :variant="roleVariantMap[char.role_type] || 'default'">
                  {{ roleLabelMap[char.role_type] || char.role_type }}
                </VBadge>
              </span>
            </div>
            <button class="char-card__del" @click.stop="deleteChar(char)">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
            </button>
          </div>
          <p v-if="char.description" class="char-card__desc">{{ char.description }}</p>
          <p v-if="char.core_desire" class="char-card__tag">
            <span class="char-card__tag-label">欲望</span>{{ char.core_desire }}
          </p>
          <p v-if="char.image_prompt" class="char-card__tag char-card__tag--image">
            <span class="char-card__tag-label">形象</span>{{ char.image_prompt }}
          </p>
        </div>
      </VCard>
    </div>
    <p v-else class="empty-text">AI 尚未生成角色，或点击"添加角色"手动创建</p>

    <VDrawer v-model="showEditor" :title="editForm.id ? '编辑角色' : '添加角色'" width="480px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model="editForm.name" label="角色名" placeholder="角色名称" />
          <VSelect v-model="editForm.role_type" label="角色类型" :options="roleOptions" />
        </div>
        <VTextarea v-model="editForm.description" label="角色描述" placeholder="外貌、性格、背景简述..." :rows="3" />
        <VTextarea v-model="editForm.core_desire" label="核心欲望" placeholder="这个角色最想要什么？" :rows="2" />
        <VTextarea v-model="editForm.weakness" label="弱点" placeholder="性格/能力上的致命弱点" :rows="2" />
        <VTextarea v-model="editForm.secret" label="秘密" placeholder="不为人知的秘密" :rows="2" />
        <div class="image-prompt-field">
          <VTextarea
            v-model="editForm.image_prompt"
            label="形象提示词（AI 绘图/视频用）"
            placeholder="例：25岁男性，面容俊朗清冷，白色汉服僧袍，腰系佛珠，眉心隐现金色舍利印记，气质出尘，背景为古代寺庙，写实风格，高清，电影质感"
            :rows="4"
          />
          <p class="image-prompt-hint">建议包含：年龄性别、面部特征、服装配饰、气质神态、背景环境、画风（写实/动漫/水墨等）</p>
        </div>
      </div>
      <template #footer>
        <VButton variant="ghost" size="sm" :loading="aiGenerating" @click="aiGenerateChar" class="ai-fill-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
            <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
          </svg>
          AI 智能填充
        </VButton>
        <VButton variant="secondary" @click="showEditor = false">取消</VButton>
        <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="saveChar">保存</VButton>
      </template>
    </VDrawer>

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
  margin-bottom: var(--space-5);
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

.regen-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.regen-bar .v-input { flex: 1; }

.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.char-card { cursor: pointer; }

.char-card__top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.char-card__top > *:first-child,
.char-card__del {
  flex-shrink: 0;
}

.char-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.char-card__name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.char-card__badge {
  flex-shrink: 0;
}

.char-card__del {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all var(--transition-fast);
}

.char-card:hover .char-card__del { opacity: 1; }
.char-card__del:hover { color: var(--accent-red); background: var(--accent-red-subtle); }

.char-card__desc {
  margin-top: var(--space-3);
  font-size: 13px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.char-card__tag {
  margin-top: var(--space-2);
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.char-card__tag-label {
  font-weight: 600;
  color: var(--accent-blue);
  margin-right: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.char-card__tag--image .char-card__tag-label {
  color: var(--accent-green);
}

.char-card__tag--image {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }

.image-prompt-field { display: flex; flex-direction: column; gap: 6px; }
.image-prompt-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
  padding: 0 2px;
}

.ai-fill-btn { margin-right: auto; }
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
