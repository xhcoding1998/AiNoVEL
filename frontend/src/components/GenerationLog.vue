<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { aiApi } from '../api/ai'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  active: { type: Boolean, default: false },
  status: { type: String, default: '' }
})

const logs = ref([])
const containerRef = ref(null)
let pollTimer = null
let lastId = 0

async function fetchLogs() {
  try {
    const res = await aiApi.getGenerationLogs(props.projectId, null, lastId)
    const rows = res.data || res || []
    if (!rows.length) return

    for (const row of rows) {
      if (row.level === 'chunk') {
        const last = logs.value[logs.value.length - 1]
        if (last && last.level === 'chunk') {
          last.message += row.message
        } else {
          logs.value.push({ ...row })
        }
      } else {
        logs.value.push(row)
      }
      lastId = row.id
    }

    if (logs.value.length > 300) logs.value.splice(0, logs.value.length - 200)
    nextTick(scrollToBottom)
  } catch { /* ignore fetch errors */ }
}

function startPolling() {
  stopPolling()
  fetchLogs()
  pollTimer = setInterval(fetchLogs, 1500)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function scrollToBottom() {
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

watch(() => props.active, (val) => {
  if (val) startPolling()
  else stopPolling()
}, { immediate: true })

watch(() => props.status, (val) => {
  if (val === 'failed') {
    stopPolling()
    fetchLogs()
  }
})

onUnmounted(stopPolling)

function levelIcon(level) {
  if (level === 'success') return '✓'
  if (level === 'error') return '✗'
  if (level === 'chunk') return '›'
  return '•'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="gen-log" ref="containerRef">
    <div v-if="!logs.length" class="gen-log__empty">等待日志...</div>
    <div
      v-for="(log, i) in logs"
      :key="log.id || i"
      class="gen-log__line"
      :class="`gen-log__line--${log.level}`"
    >
      <span class="gen-log__icon">{{ levelIcon(log.level) }}</span>
      <span v-if="log.level !== 'chunk'" class="gen-log__time">{{ formatTime(log.created_at) }}</span>
      <span class="gen-log__msg" :class="{ 'gen-log__msg--chunk': log.level === 'chunk' }">{{ log.message }}</span>
      <span v-if="log.level === 'chunk' && i === logs.length - 1" class="gen-log__cursor" />
    </div>
  </div>
</template>

<style scoped>
.gen-log {
  max-height: 220px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  margin-top: 10px;
  scroll-behavior: smooth;
}

.gen-log::-webkit-scrollbar {
  width: 4px;
}

.gen-log::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 2px;
}

.gen-log__empty {
  color: var(--text-tertiary);
  font-style: italic;
  text-align: center;
  padding: 12px 0;
}

.gen-log__line {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 1px 0;
}

.gen-log__icon {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  color: var(--text-tertiary);
  font-weight: 700;
}

.gen-log__line--success .gen-log__icon {
  color: var(--accent-green);
}

.gen-log__line--error .gen-log__icon {
  color: var(--accent-red);
}

.gen-log__line--info .gen-log__icon {
  color: var(--accent-blue);
}

.gen-log__line--chunk .gen-log__icon {
  color: var(--text-tertiary);
  opacity: 0.4;
}

.gen-log__time {
  flex-shrink: 0;
  color: var(--text-tertiary);
  opacity: 0.6;
  font-size: 11px;
}

.gen-log__msg {
  color: var(--text-secondary);
  word-break: break-all;
}

.gen-log__msg--chunk {
  color: var(--text-tertiary);
  white-space: pre-wrap;
}

.gen-log__line--success .gen-log__msg {
  color: var(--accent-green);
  font-weight: 500;
}

.gen-log__line--error .gen-log__msg {
  color: var(--accent-red);
}

.gen-log__cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background: var(--accent-blue);
  border-radius: 1px;
  animation: log-blink 1s step-end infinite;
  vertical-align: text-bottom;
  flex-shrink: 0;
  margin-left: 2px;
}

@keyframes log-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
