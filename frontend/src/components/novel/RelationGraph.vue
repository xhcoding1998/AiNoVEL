<script setup>
import { ref, onMounted, watch, nextTick, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { useCascadeRegenerate } from '../../composables/useCascadeRegenerate'
import { useGraph } from '../../composables/useGraph'
import { aiApi } from '../../api/ai'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VModal from '../ui/VModal.vue'
import VInput from '../ui/VInput.vue'
import VSelect from '../ui/VSelect.vue'
import VTextarea from '../ui/VTextarea.vue'
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

const { graphData, layout, viewBox } = useGraph(
  () => store.characters,
  () => store.relations
)

const showAddRelation = ref(false)
const saving = ref(false)
const aiGenerating = ref(false)
const expandedRelation = ref(null)
const showDeleteConfirm = ref(false)
const deletingRelationId = ref(null)
const deleting = ref(false)
const relationForm = ref({
  id: null, from_character_id: null, to_character_id: null,
  relation_type: '', faction: '', interest_link: '', emotion_link: '', description: ''
})

const relationTypes = [
  '同盟', '敌对', '恋人', '暗恋', '虐恋', '亲属', '上下级', '师徒', '挚友', '竞争', '利用', '监视', '宿命', '对照', '其他'
].map(v => ({ label: v, value: v }))

const typeVariant = { '同盟': 'info', '敌对': 'danger', '恋人': 'purple', '暗恋': 'purple', '虐恋': 'danger', '亲属': 'default', '挚友': 'success', '竞争': 'warning', '利用': 'warning', '监视': 'danger' }

async function loadData() {
  await Promise.all([store.fetchCharacters(pid), store.fetchRelations(pid)])
  nextTick(layout)
}

onMounted(loadData)
watch([() => store.characters, () => store.relations], () => nextTick(layout), { deep: true })

function characterOptions() { return store.characters.map(c => ({ label: c.name, value: c.id })) }
function charName(id) { return store.characters.find(c => c.id === id)?.name || '?' }

function openAddRelation() {
  relationForm.value = { id: null, from_character_id: null, to_character_id: null, relation_type: '', faction: '', interest_link: '', emotion_link: '', description: '' }
  showAddRelation.value = true
}

async function saveRelation() {
  if (!relationForm.value.from_character_id || !relationForm.value.to_character_id) { toast.warning('请选择两个角色'); return }
  saving.value = true
  try {
    await store.saveRelation(pid, relationForm.value)
    toast.success('已保存')
    showAddRelation.value = false
    promptCascade(pid, 'relations', loadData)
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function requestDeleteRelation(id) {
  deletingRelationId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteRelation() {
  deleting.value = true
  try {
    await store.deleteRelation(pid, deletingRelationId.value)
    toast.success('已删除')
    showDeleteConfirm.value = false
  } catch {
    toast.error('删除失败')
  } finally {
    deleting.value = false
  }
}

function handleRegenClick() {
  requestRegenerate(pid, 'relations', loadData)
}

async function aiGenerateRelation() {
  aiGenerating.value = true
  try {
    const fromName = charName(relationForm.value.from_character_id)
    const toName = charName(relationForm.value.to_character_id)
    let hint = '请为项目中的角色生成一条新关系'
    if (fromName !== '?' && toName !== '?') {
      hint = `请为「${fromName}」和「${toName}」生成关系`
    } else if (fromName !== '?') {
      hint = `请为「${fromName}」和另一个角色生成关系`
    }
    const res = await aiApi.generateSingleItem(pid, 'relation', hint)
    const data = res.data || res

    if (data.from_name) {
      const fromChar = store.characters.find(c => c.name === data.from_name)
      if (fromChar) relationForm.value.from_character_id = fromChar.id
    }
    if (data.to_name) {
      const toChar = store.characters.find(c => c.name === data.to_name)
      if (toChar) relationForm.value.to_character_id = toChar.id
    }
    relationForm.value.relation_type = data.relation_type || ''
    relationForm.value.faction = data.faction || ''
    relationForm.value.interest_link = data.interest_link || ''
    relationForm.value.emotion_link = data.emotion_link || ''
    relationForm.value.description = data.description || ''
    toast.success('AI 已生成关系内容，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiGenerating.value = false
  }
}

function edgePath(points) {
  if (!points || points.length < 2) return ''
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`
  }
  if (points.length === 3) {
    const [p0, p1, p2] = points
    return `M${p0.x},${p0.y} Q${p1.x},${p1.y} ${p2.x},${p2.y}`
  }
  // 4+ points: smooth cubic bezier through midpoints
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const midX = (curr.x + next.x) / 2
    const midY = (curr.y + next.y) / 2
    if (i === points.length - 2) {
      d += ` Q${curr.x},${curr.y} ${next.x},${next.y}`
    } else {
      d += ` Q${curr.x},${curr.y} ${midX},${midY}`
    }
  }
  return d
}

function edgeLabelPos(points) {
  if (!points || points.length < 2) return { x: 0, y: 0 }
  if (points.length === 2) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
  }
  if (points.length === 3) {
    const t = 0.5
    const x = (1 - t) * (1 - t) * points[0].x + 2 * (1 - t) * t * points[1].x + t * t * points[2].x
    const y = (1 - t) * (1 - t) * points[0].y + 2 * (1 - t) * t * points[1].y + t * t * points[2].y
    return { x, y }
  }
  const mid = Math.floor(points.length / 2)
  return { x: (points[mid - 1].x + points[mid].x) / 2, y: (points[mid - 1].y + points[mid].y) / 2 }
}

const roleColorMap = { male_lead: '#0070f3', female_lead: '#8b5cf6', supporting: '#525252', antagonist: '#ee4444' }
const roleLabel = { male_lead: '男主', female_lead: '女主', supporting: '配角', antagonist: '反派' }
</script>

<template>
  <div>
    <div class="section-header">
      <div class="section-header__left">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="5" cy="7" r="2.5"/><circle cx="13" cy="7" r="2.5"/><circle cx="9" cy="14" r="2.5"/>
          <path d="M7.3 8l1.7 4.5M10.7 8l-1.7 4.5M7.5 7h3" stroke-linecap="round" opacity="0.5"/>
        </svg>
        <h3 class="section-title" style="margin:0">人物关系图</h3>
      </div>
      <div class="section-header__actions">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating" :disabled="isGenerating">
          AI 重新生成
        </VButton>
        <VButton variant="secondary" size="sm" @click="openAddRelation">添加关系</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加更复杂的利益纠葛..." />
      <VButton variant="primary" size="sm" :loading="regenerating" :disabled="isGenerating" @click="handleRegenClick">生成</VButton>
    </div>

    <VCard v-if="graphData.nodes.length" padding="sm" class="graph-card">
      <svg class="relation-svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="relation-arrow" />
          </marker>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15" />
          </filter>
        </defs>
        <g v-for="(edge, i) in graphData.edges" :key="'e' + i">
          <path :d="edgePath(edge.points)" fill="none" class="relation-edge" stroke-width="1.5" marker-end="url(#arrowhead)" />
          <template v-if="edge.label">
            <rect
              :x="edgeLabelPos(edge.points).x - edge.label.length * 5.5 - 8"
              :y="edgeLabelPos(edge.points).y - 18"
              :width="edge.label.length * 11 + 16"
              :height="22"
              rx="6"
              class="relation-edge-label-bg"
            />
            <text :x="edgeLabelPos(edge.points).x" :y="edgeLabelPos(edge.points).y - 2" text-anchor="middle" class="relation-edge-label" font-size="11" font-weight="500">{{ edge.label }}</text>
          </template>
        </g>
        <g v-for="node in graphData.nodes" :key="'n' + node.id" filter="url(#node-shadow)">
          <rect
            :x="node.x - node.width / 2"
            :y="node.y - node.height / 2"
            :width="node.width"
            :height="node.height"
            rx="10"
            class="relation-node-bg"
            :style="{ '--node-color': roleColorMap[node.data?.role_type] || '#525252' }"
          />
          <rect
            :x="node.x - node.width / 2"
            :y="node.y - node.height / 2"
            :width="node.width"
            :height="node.height"
            rx="10"
            class="relation-node-border"
            :style="{ '--node-color': roleColorMap[node.data?.role_type] || '#525252' }"
          />
          <text :x="node.x" :y="node.y + 1" text-anchor="middle" class="relation-node-label" font-size="13" font-weight="600">
            <title>{{ node.label }}</title>
            {{ node.displayLabel || node.label }}
          </text>
          <g v-if="roleLabel[node.data?.role_type]">
            <rect
              :x="node.x + node.width / 2 - 28"
              :y="node.y - node.height / 2 - 8"
              width="32" height="16" rx="4"
              :fill="roleColorMap[node.data?.role_type] || '#525252'"
              opacity="0.9"
            />
            <text
              :x="node.x + node.width / 2 - 12"
              :y="node.y - node.height / 2 + 4"
              text-anchor="middle" fill="#fff" font-size="9" font-weight="600"
            >{{ roleLabel[node.data?.role_type] }}</text>
          </g>
        </g>
      </svg>
    </VCard>

    <div v-if="store.relations.length" class="relation-list">
      <div class="relation-list__title">关系详情 · {{ store.relations.length }} 条</div>
      <VCard v-for="r in store.relations" :key="r.id" padding="sm" class="relation-card">
        <div class="rel-row" @click="expandedRelation = expandedRelation === r.id ? null : r.id">
          <div class="rel-row__main">
            <span class="rel-row__from">{{ charName(r.from_character_id) }}</span>
            <svg width="20" height="12" viewBox="0 0 20 12" fill="none" class="rel-row__arrow">
              <path d="M0 6h16M13 2l4 4-4 4" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="rel-row__to">{{ charName(r.to_character_id) }}</span>
            <VBadge :variant="typeVariant[r.relation_type] || 'default'">{{ r.relation_type }}</VBadge>
            <VBadge v-if="r.faction" variant="default">{{ r.faction }}</VBadge>
          </div>
          <button class="rel-row__del" @click.stop="requestDeleteRelation(r.id)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <Transition name="slide-up">
          <div v-if="expandedRelation === r.id" class="rel-detail">
            <div v-if="r.interest_link" class="rel-detail__row">
              <label>利益链</label>
              <p>{{ r.interest_link }}</p>
            </div>
            <div v-if="r.emotion_link" class="rel-detail__row">
              <label>情感链</label>
              <p>{{ r.emotion_link }}</p>
            </div>
            <div v-if="r.description" class="rel-detail__row">
              <label>关系动态</label>
              <p>{{ r.description }}</p>
            </div>
          </div>
        </Transition>
      </VCard>
    </div>

    <p v-else-if="!graphData.nodes.length" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="12" cy="16" r="6" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
        <circle cx="28" cy="16" r="6" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
        <circle cx="20" cy="30" r="6" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
        <line x1="17" y1="18" x2="23" y2="18" stroke="var(--text-tertiary)" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="14" y1="21" x2="18" y2="25" stroke="var(--text-tertiary)" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="26" y1="21" x2="22" y2="25" stroke="var(--text-tertiary)" stroke-width="1" stroke-dasharray="2 2"/>
      </svg>
      <span>AI 尚未生成角色关系</span>
    </p>

    <VModal v-model="showAddRelation" title="添加关系" width="480px">
      <div class="form-grid">
        <VSelect v-model="relationForm.from_character_id" label="角色 A" :options="characterOptions()" />
        <VSelect v-model="relationForm.to_character_id" label="角色 B" :options="characterOptions()" />
        <VSelect v-model="relationForm.relation_type" label="关系类型" :options="relationTypes" />
        <VInput v-model="relationForm.faction" label="阵营" placeholder="所属阵营" />
        <VTextarea v-model="relationForm.interest_link" label="利益链" placeholder="两人之间的利益纠葛..." :rows="2" />
        <VTextarea v-model="relationForm.emotion_link" label="情感链" placeholder="两人之间的情感关系..." :rows="2" />
        <VTextarea v-model="relationForm.description" label="关系描述" placeholder="补充描述..." :rows="2" />
      </div>
      <template #footer>
        <div class="modal-footer-full">
          <VButton variant="ghost" size="sm" :loading="aiGenerating" @click="aiGenerateRelation" class="ai-fill-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
            </svg>
            AI 智能填充
          </VButton>
          <div class="modal-footer-right">
            <VButton variant="secondary" @click="showAddRelation = false">取消</VButton>
            <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="saveRelation">保存</VButton>
          </div>
        </div>
      </template>
    </VModal>

    <VConfirmModal
      v-model="showConfirmModal"
      title="确认重新生成人物关系"
      confirm-text="确认重新生成"
      :affected-steps="affectedSteps"
      :loading="regenerating"
      @confirm="confirmRegenerate"
      @cancel="cancelRegenerate"
    >
      <p>重新生成「人物关系」将覆盖当前所有关系数据，且由于内容链路的依赖关系，此阶段之后的所有内容也可能需要重新生成以保持一致性。</p>
    </VConfirmModal>

    <VConfirmModal
      v-model="showCascadeModal"
      title="是否重新生成后续内容？"
      confirm-text="重新生成后续"
      cancel-text="跳过"
      confirm-variant="primary"
      :affected-steps="cascadeAffectedSteps"
      :loading="cascadeLoading"
      @confirm="confirmCascade"
      @cancel="cancelCascade"
    >
      <p>你修改了「{{ cascadeStepLabel }}」，后续内容依赖此信息。建议重新生成以保持一致性，也可跳过稍后手动处理。</p>
    </VConfirmModal>

    <VConfirmModal
      v-model="showDeleteConfirm"
      title="确认删除关系"
      confirm-text="删除"
      :loading="deleting"
      @confirm="confirmDeleteRelation"
      @cancel="showDeleteConfirm = false"
    >
      <p>确定删除该关系吗？此操作不可恢复。</p>
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
  font-family: var(--font-display);
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

.graph-card {
  margin-bottom: 24px;
  overflow: hidden;
  background: var(--bg-nested);
  border-radius: var(--radius-lg);
}

.relation-svg {
  width: 100%;
  min-height: 380px;
  max-height: 520px;
  display: block;
}

.relation-arrow {
  fill: var(--text-secondary);
}

.relation-edge {
  stroke: var(--border-hover);
  transition: stroke 0.2s ease;
}

.relation-edge-label-bg {
  fill: var(--bg-elevated);
  stroke: var(--border-default);
  stroke-width: 1;
}

.relation-edge-label {
  fill: var(--text-primary);
}

.relation-node-bg {
  fill: var(--node-color);
  opacity: 0.14;
}

.relation-node-border {
  fill: none;
  stroke: var(--node-color);
  stroke-width: 2;
  opacity: 0.85;
}

.relation-node-label {
  fill: var(--text-primary);
  font-family: var(--font-display);
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.relation-list__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.rel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.rel-row__main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rel-row__from, .rel-row__to {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
}

.rel-row__arrow {
  flex-shrink: 0;
  opacity: 0.5;
}

.rel-row__del {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all var(--transition-fast);
}

.relation-card:hover .rel-row__del { opacity: 1; }
.rel-row__del:hover { color: var(--accent-red); background: var(--accent-red-subtle); }

.rel-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rel-detail__row label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  display: block;
  margin-bottom: 4px;
}

.rel-detail__row p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

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

.form-grid { display: flex; flex-direction: column; gap: 16px; }

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
