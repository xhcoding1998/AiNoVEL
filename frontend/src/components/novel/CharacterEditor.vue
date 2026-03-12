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
import VAvatar from '../ui/VAvatar.vue'
import VBadge from '../ui/VBadge.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()
const pid = route.params.id

const showEditor = ref(false)
const saving = ref(false)
const editForm = ref(emptyForm())

const roleOptions = [
  { label: '男主', value: 'male_lead' },
  { label: '女主', value: 'female_lead' },
  { label: '配角', value: 'supporting' },
  { label: '反派', value: 'antagonist' }
]

const roleLabelMap = { male_lead: '男主', female_lead: '女主', supporting: '配角', antagonist: '反派' }
const roleVariantMap = { male_lead: 'info', female_lead: 'purple', supporting: 'default', antagonist: 'danger' }

function emptyForm() {
  return { id: null, name: '', role_type: 'supporting', description: '', core_desire: '', weakness: '', secret: '', avatar_color: '#0070f3' }
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
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function deleteChar(id) {
  if (!confirm('确定删除该角色？')) return
  try { await store.deleteCharacter(pid, id); toast.success('已删除') }
  catch { toast.error('删除失败') }
}

async function handleRegen() {
  await regenerateSection(pid, 'characters', loadData)
}
</script>

<template>
  <div>
    <div class="char-header">
      <h3 class="section-title">角色设定</h3>
      <div class="flex gap-2">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
        <VButton variant="primary" size="sm" @click="openCreate">添加角色</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加一个亦正亦邪的角色..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <div v-if="store.characters.length" class="char-grid">
      <VCard v-for="char in store.characters" :key="char.id" hoverable padding="sm">
        <div class="char-card" @click="openEdit(char)">
          <div class="char-card__top">
            <VAvatar :name="char.name" :color="char.avatar_color" :size="36" />
            <div class="char-card__info">
              <span class="char-card__name">{{ char.name }}</span>
              <VBadge :variant="roleVariantMap[char.role_type] || 'default'">
                {{ roleLabelMap[char.role_type] || char.role_type }}
              </VBadge>
            </div>
            <button class="char-card__del" @click.stop="deleteChar(char.id)">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
            </button>
          </div>
          <p v-if="char.description" class="char-card__desc">{{ char.description }}</p>
          <p v-if="char.core_desire" class="char-card__tag">欲望：{{ char.core_desire }}</p>
        </div>
      </VCard>
    </div>
    <p v-else class="empty-text">AI 尚未生成角色，或点击"添加角色"手动创建</p>

    <VModal v-model="showEditor" :title="editForm.id ? '编辑角色' : '添加角色'" width="520px">
      <div class="form-grid">
        <div class="form-row">
          <VInput v-model="editForm.name" label="角色名" placeholder="角色名称" />
          <VSelect v-model="editForm.role_type" label="角色类型" :options="roleOptions" />
        </div>
        <VTextarea v-model="editForm.description" label="角色描述" placeholder="外貌、性格、背景简述..." :rows="2" />
        <VTextarea v-model="editForm.core_desire" label="核心欲望" placeholder="这个角色最想要什么？" :rows="2" />
        <VTextarea v-model="editForm.weakness" label="弱点" placeholder="性格/能力上的致命弱点" :rows="2" />
        <VTextarea v-model="editForm.secret" label="秘密" placeholder="不为人知的秘密" :rows="2" />
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showEditor = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveChar">保存</VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.char-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.regen-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-default); }
.regen-bar .v-input { flex: 1; }
.char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3); }
.char-card { cursor: pointer; }
.char-card__top { display: flex; align-items: center; gap: var(--space-3); }
.char-card__info { flex: 1; display: flex; align-items: center; gap: var(--space-2); }
.char-card__name { font-weight: 600; font-size: 14px; }
.char-card__del { color: var(--text-tertiary); padding: 4px; border-radius: var(--radius-sm); opacity: 0; transition: all var(--transition-fast); }
.char-card:hover .char-card__del { opacity: 1; }
.char-card__del:hover { color: var(--accent-red); background: var(--bg-hover); }
.char-card__desc { margin-top: var(--space-2); font-size: 13px; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.char-card__tag { margin-top: var(--space-1); font-size: 12px; color: var(--text-tertiary); }
.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-8); }
</style>
