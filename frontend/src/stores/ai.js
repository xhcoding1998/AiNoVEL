import { defineStore } from 'pinia'
import { ref } from 'vue'
import { aiApi } from '../api/ai'

export const useAIStore = defineStore('ai', () => {
  const tasks = ref([])
  const currentTask = ref(null)
  const loading = ref(false)

  async function fetchTasks(projectId) {
    loading.value = true
    try {
      const res = await aiApi.getTasks(projectId)
      tasks.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function generateAll(projectId, prompt) {
    loading.value = true
    try {
      const res = await aiApi.generateAll(projectId, prompt)
      tasks.value.unshift(res.data)
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function generateSection(projectId, section, prompt) {
    const res = await aiApi.generateSection(projectId, section, prompt)
    tasks.value.unshift(res.data)
    return res.data
  }

  async function getTaskResult(projectId, taskId) {
    const res = await aiApi.getTask(projectId, taskId)
    currentTask.value = res.data
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = res.data
    return res.data
  }

  async function compileMaterial(projectId) {
    const res = await aiApi.compileMaterial(projectId)
    return res.data
  }

  return {
    tasks, currentTask, loading,
    fetchTasks, generateAll, generateSection, getTaskResult, compileMaterial
  }
})
