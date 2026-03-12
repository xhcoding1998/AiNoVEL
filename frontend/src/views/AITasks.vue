<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAIStore } from '../stores/ai'
import { useToast } from '../composables/useToast'
import { aiApi } from '../api/ai'
import VButton from '../components/ui/VButton.vue'
import VCard from '../components/ui/VCard.vue'
import VBadge from '../components/ui/VBadge.vue'
import VTextarea from '../components/ui/VTextarea.vue'
import VLoading from '../components/ui/VLoading.vue'

const route = useRoute()
const aiStore = useAIStore()
const toast = useToast()

const prompt = ref('')
const running = ref(false)
const expandedTask = ref(null)
const pid = route.params.id

onMounted(() => aiStore.fetchTasks(pid))

async function regenerateAll() {
  if (!prompt.value.trim()) {
    toast.warning('请输入创作指令')
    return
  }
  running.value = true
  try {
    await aiApi.generateAll(pid, prompt.value.trim())
    toast.success('AI 正在生成物料...')
    prompt.value = ''
    setTimeout(() => aiStore.fetchTasks(pid), 2000)
  } catch (err) {
    toast.error(err.error || '启动失败，请检查AI配置')
  } finally {
    running.value = false
  }
}

const statusMap = {
  pending: { label: '等待中', variant: 'default' },
  running: { label: '运行中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' }
}

const typeMap = {
  full_generation: '全量生成',
  regen_basic_info: '重新生成 - 基础信息',
  regen_world_building: '重新生成 - 世界观',
  regen_characters: '重新生成 - 角色',
  regen_relations: '重新生成 - 关系',
  regen_plot_control: '重新生成 - 剧情',
  regen_volumes: '重新生成 - 分卷',
  regen_writing_style: '重新生成 - 风格'
}

function toggleTask(id) {
  expandedTask.value = expandedTask.value === id ? null : id
}
</script>

<template>
  <div>
    <VCard>
      <template #header>AI 创作指令</template>
      <div class="pipeline-input">
        <VTextarea
          v-model="prompt"
          placeholder="输入新的创作指令，AI 将基于当前物料重新生成全部内容...&#10;例如：调整世界观为末日废土风格，增加一个神秘组织作为幕后黑手"
          :rows="3"
        />
        <div class="pipeline-actions">
          <span class="pipeline-hint">将基于当前物料一次性重新生成全部 7 大类内容</span>
          <VButton variant="primary" :loading="running" @click="regenerateAll">全部重新生成</VButton>
        </div>
      </div>
    </VCard>

    <div class="tasks-section">
      <h3 class="section-title">任务历史</h3>
      <VLoading v-if="aiStore.loading" text="加载中..." />
      <div v-else-if="aiStore.tasks.length" class="task-list">
        <VCard v-for="task in aiStore.tasks" :key="task.id" padding="sm">
          <div class="task-item" @click="toggleTask(task.id)">
            <div class="task-item__header">
              <span class="task-item__type">{{ typeMap[task.task_type] || task.task_type }}</span>
              <VBadge :variant="statusMap[task.status]?.variant || 'default'">
                {{ statusMap[task.status]?.label || task.status }}
              </VBadge>
            </div>
            <p v-if="task.prompt" class="task-item__prompt">{{ task.prompt }}</p>
            <div v-if="expandedTask === task.id && task.result" class="task-item__result">
              <pre>{{ task.result }}</pre>
            </div>
          </div>
        </VCard>
      </div>
      <p v-else class="empty-text">暂无任务记录</p>
    </div>
  </div>
</template>

<style scoped>
.pipeline-input { display: flex; flex-direction: column; gap: var(--space-3); }
.pipeline-actions { display: flex; align-items: center; justify-content: space-between; }
.pipeline-hint { font-size: 12px; color: var(--text-tertiary); }
.tasks-section { margin-top: var(--space-6); }
.task-list { display: flex; flex-direction: column; gap: var(--space-3); }
.task-item { cursor: pointer; }
.task-item__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
.task-item__type { font-weight: 600; font-size: 13px; }
.task-item__prompt { font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-item__result { margin-top: var(--space-3); padding: var(--space-3); background: var(--bg-secondary); border-radius: var(--radius-md); max-height: 300px; overflow-y: auto; }
.task-item__result pre { font-family: var(--font-mono); font-size: 13px; white-space: pre-wrap; word-break: break-all; }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-8); }
</style>
