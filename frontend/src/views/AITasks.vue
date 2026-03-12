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
    toast.success('AI 正在分步生成物料...')
    prompt.value = ''
    setTimeout(() => aiStore.fetchTasks(pid), 2000)
  } catch (err) {
    toast.error(err?.error || '启动失败，请检查AI配置')
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
  full_generation: '全量生成（分步）',
  continue_generation: '继续生成（断点续传）',
  regen_basic_info: '重新生成 · 基础信息',
  regen_world_building: '重新生成 · 世界观',
  regen_characters: '重新生成 · 角色',
  regen_relations: '重新生成 · 关系',
  regen_plot_control: '重新生成 · 剧情',
  regen_volumes: '重新生成 · 分卷',
  regen_writing_style: '重新生成 · 风格'
}

function toggleTask(id) {
  expandedTask.value = expandedTask.value === id ? null : id
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}
</script>

<template>
  <div>
    <VCard>
      <template #header>
        <div class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5z" stroke-linejoin="round"/>
          </svg>
          <span>AI 创作指令</span>
        </div>
      </template>
      <div class="pipeline-input">
        <VTextarea
          v-model="prompt"
          placeholder="输入创作指令，AI 将分步生成全部内容，每步完成即可查看...&#10;例如：调整世界观为末日废土风格，增加一个神秘组织作为幕后黑手"
          :rows="3"
        />
        <div class="pipeline-actions">
          <span class="pipeline-hint">AI 将逐步生成：基础信息 → 世界观 → 角色 → 关系 → 剧情 → 分卷 → 风格</span>
          <VButton variant="primary" :loading="running" @click="regenerateAll">全部重新生成</VButton>
        </div>
      </div>
    </VCard>

    <div class="tasks-section">
      <h3 class="tasks-section__title">任务历史</h3>
      <VLoading v-if="aiStore.loading" text="加载中..." />
      <div v-else-if="aiStore.tasks.length" class="task-list">
        <VCard v-for="task in aiStore.tasks" :key="task.id" padding="sm" hoverable>
          <div class="task-item" @click="toggleTask(task.id)">
            <div class="task-item__header">
              <div class="task-item__left">
                <span class="task-item__type">{{ typeMap[task.task_type] || task.task_type }}</span>
                <span class="task-item__time">{{ formatTime(task.created_at) }}</span>
              </div>
              <VBadge :variant="statusMap[task.status]?.variant || 'default'">
                {{ statusMap[task.status]?.label || task.status }}
              </VBadge>
            </div>
            <p v-if="task.prompt" class="task-item__prompt">{{ task.prompt }}</p>
            <Transition name="slide-up">
              <div v-if="expandedTask === task.id && task.result" class="task-item__result">
                <pre>{{ task.result }}</pre>
              </div>
            </Transition>
          </div>
        </VCard>
      </div>
      <p v-else class="empty-state">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="8" width="28" height="20" rx="3" stroke="var(--text-tertiary)" stroke-width="1.5" fill="none"/>
          <path d="M12 16h12M12 20h8" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>暂无任务记录</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.pipeline-input { display: flex; flex-direction: column; gap: 12px; }
.pipeline-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.pipeline-hint { font-size: 12px; color: var(--text-tertiary); }

.tasks-section { margin-top: 28px; }
.tasks-section__title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
  letter-spacing: -0.01em;
}

.task-list { display: flex; flex-direction: column; gap: 8px; }
.task-item { cursor: pointer; }

.task-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.task-item__left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.task-item__type { font-weight: 600; font-size: 13px; }
.task-item__time { font-size: 12px; color: var(--text-tertiary); }

.task-item__prompt {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-item__result {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  max-height: 300px;
  overflow-y: auto;
}

.task-item__result pre {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  color: var(--text-secondary);
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
</style>
