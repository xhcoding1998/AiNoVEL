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
const relationForm = ref({
  id: null, from_character_id: null, to_character_id: null,
  relation_type: '', faction: '', interest_link: '', emotion_link: '', description: ''
})

const relationTypes = [
  '同盟', '敌对', '恋人', '亲属', '上下级', '师徒', '挚友', '竞争', '利用', '其他'
].map(v => ({ label: v, value: v }))

async function loadData() {
  await Promise.all([store.fetchCharacters(pid), store.fetchRelations(pid)])
  nextTick(layout)
}

onMounted(loadData)
watch([() => store.characters, () => store.relations], () => nextTick(layout), { deep: true })

function characterOptions() { return store.characters.map(c => ({ label: c.name, value: c.id })) }

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
    <div class="graph-header">
      <h3 class="section-title" style="margin:0">人物关系图</h3>
      <div class="flex gap-2">
        <VButton variant="ghost" size="sm" @click="showRegenInput = !showRegenInput" :loading="regenerating">
          AI 重新生成
        </VButton>
        <VButton variant="primary" size="sm" @click="openAddRelation">添加关系</VButton>
      </div>
    </div>

    <div v-if="showRegenInput" class="regen-bar">
      <VInput v-model="regenPrompt" placeholder="补充指令（可选），如：增加更复杂的利益纠葛..." />
      <VButton variant="primary" size="sm" :loading="regenerating" @click="handleRegen">生成</VButton>
    </div>

    <VCard v-if="graphData.nodes.length" padding="sm">
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
    <p v-else class="empty-text">AI 尚未生成角色关系，或手动添加</p>

    <div v-if="store.relations.length" class="relation-list">
      <h3 class="section-title">关系列表</h3>
      <VCard v-for="r in store.relations" :key="r.id" padding="sm">
        <div class="relation-item">
          <span class="relation-item__names">{{ store.characters.find(c => c.id === r.from_character_id)?.name || '?' }} → {{ store.characters.find(c => c.id === r.to_character_id)?.name || '?' }}</span>
          <span class="relation-item__type">{{ r.relation_type }}</span>
          <button class="relation-item__del" @click="deleteRelation(r.id)">删除</button>
        </div>
      </VCard>
    </div>

    <VModal v-model="showAddRelation" title="添加关系" width="480px">
      <div class="form-grid">
        <VSelect v-model="relationForm.from_character_id" label="角色 A" :options="characterOptions()" />
        <VSelect v-model="relationForm.to_character_id" label="角色 B" :options="characterOptions()" />
        <VSelect v-model="relationForm.relation_type" label="关系类型" :options="relationTypes" />
        <VInput v-model="relationForm.faction" label="阵营" placeholder="所属阵营" />
        <VTextarea v-model="relationForm.interest_link" label="利益链" :rows="2" />
        <VTextarea v-model="relationForm.emotion_link" label="情感链" :rows="2" />
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showAddRelation = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveRelation">保存</VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.graph-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.regen-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-default); }
.regen-bar .v-input { flex: 1; }
.relation-svg { width: 100%; min-height: 350px; max-height: 500px; }
.relation-list { margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-2); }
.relation-item { display: flex; align-items: center; gap: var(--space-3); }
.relation-item__names { font-size: 14px; font-weight: 500; flex: 1; }
.relation-item__type { font-size: 13px; color: var(--text-secondary); }
.relation-item__del { font-size: 12px; color: var(--accent-red); opacity: 0.6; }
.relation-item__del:hover { opacity: 1; }
.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-8); }
</style>
