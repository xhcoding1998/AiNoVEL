<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { useGraph } from '../../composables/useGraph'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VModal from '../ui/VModal.vue'
import VInput from '../ui/VInput.vue'
import VSelect from '../ui/VSelect.vue'
import VTextarea from '../ui/VTextarea.vue'
import VBadge from '../ui/VBadge.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const { showRegenInput, regenPrompt, regenerating, regenerateSection } = useAIRegenerate()
const pid = route.params.id

const { graphData, layout, viewBox } = useGraph(
  () => store.characters,
  () => store.relations
)

const showAddRelation = ref(false)
const saving = ref(false)
const expandedRelation = ref(null)
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
  try { await store.saveRelation(pid, relationForm.value); toast.success('已保存'); showAddRelation.value = false }
  catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function deleteRelation(id) {
  if (!confirm('确定删除该关系？')) return
  try { await store.deleteRelation(pid, id); toast.success('已删除') }
  catch { toast.error('删除失败') }
}

async function handleRegen() {
  await regenerateSection(pid, 'relations', loadData)
}

function edgePath(points) {
  if (!points || points.length < 2) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
}

function edgeLabelPos(points) {
  if (!points || points.length < 2) return { x: 0, y: 0 }
  return points[Math.floor(points.length / 2)]
}

const roleColorMap = { male_lead: '#0070f3', female_lead: '#8b5cf6', supporting: '#525252', antagonist: '#ee4444' }
</script>

<template>
  <div>
    <div class="section-header">
      <h3 class="section-title">人物关系图</h3>
      <div class="section-header__actions">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
        <VButton variant="secondary" size="sm" @click="openAddRelation">添加关系</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加更复杂的利益纠葛..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <!-- Graph -->
    <VCard v-if="graphData.nodes.length" padding="sm" class="graph-card">
      <svg class="relation-svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-tertiary)" />
          </marker>
        </defs>
        <g v-for="(edge, i) in graphData.edges" :key="'e' + i">
          <path :d="edgePath(edge.points)" fill="none" stroke="var(--border-hover)" stroke-width="1.5" marker-end="url(#arrowhead)" />
          <text v-if="edge.label" :x="edgeLabelPos(edge.points).x" :y="edgeLabelPos(edge.points).y - 6" text-anchor="middle" fill="var(--text-tertiary)" font-size="11">{{ edge.label }}</text>
        </g>
        <g v-for="node in graphData.nodes" :key="'n' + node.id">
          <rect :x="node.x - node.width / 2" :y="node.y - node.height / 2" :width="node.width" :height="node.height" rx="8" :fill="roleColorMap[node.data?.role_type] || '#525252'" opacity="0.15" :stroke="roleColorMap[node.data?.role_type] || '#525252'" stroke-width="1" />
          <text :x="node.x" :y="node.y + 5" text-anchor="middle" fill="var(--text-primary)" font-size="13" font-weight="600">{{ node.label }}</text>
        </g>
      </svg>
    </VCard>

    <!-- Relation detail list -->
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
          <button class="rel-row__del" @click.stop="deleteRelation(r.id)">
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
        <VButton variant="secondary" @click="showAddRelation = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveRelation">保存</VButton>
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

.graph-card {
  margin-bottom: 24px;
}

.relation-svg { width: 100%; min-height: 350px; max-height: 500px; }

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.relation-list__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.relation-card {
  transition: border-color 0.15s;
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
  font-weight: 600;
  font-size: 14px;
}

.rel-row__arrow {
  flex-shrink: 0;
}

.rel-row__del {
  color: var(--text-tertiary);
  padding: 4px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all 0.15s;
}

.relation-card:hover .rel-row__del { opacity: 1; }
.rel-row__del:hover { color: var(--accent-red); background: var(--bg-hover); }

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
  letter-spacing: 0.05em;
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
</style>
