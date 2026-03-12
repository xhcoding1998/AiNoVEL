import client from './client'

const API_BASE = import.meta.env.VITE_API_URL || 'http://159.75.129.108/api'

export const aiApi = {
  generateAll: (pid, prompt) => client.post(`/projects/${pid}/generate-all`, { prompt }),
  continueGeneration: (pid) => client.post(`/projects/${pid}/continue-generation`),
  generateSection: (pid, section, prompt) => client.post(`/projects/${pid}/generate-section`, { section, prompt }),
  getGenerationStatus: (pid) => client.get(`/projects/${pid}/generation-status`),
  getTasks: (pid) => client.get(`/projects/${pid}/ai-tasks`),
  getTask: (pid, tid) => client.get(`/projects/${pid}/ai-tasks/${tid}`),
  compileMaterial: (pid) => client.post(`/projects/${pid}/material/compile`),
  getMaterial: (pid) => client.get(`/projects/${pid}/material`),
  generateVolumeChapters: (pid, volumeId, prompt) => client.post(`/projects/${pid}/generate-volume-chapters`, { volume_id: volumeId, prompt }),
  generateChapterContent: (pid, chapterId) => client.post(`/projects/${pid}/generate-chapter-content`, { chapter_id: chapterId }),
  getPreview: (pid) => client.get(`/projects/${pid}/preview`),
  generateSingleItem: (pid, itemType, context) => client.post(`/projects/${pid}/generate-single-item`, { item_type: itemType, context }),
  getGenerationLogs: (pid, taskId) => client.get(`/projects/${pid}/generation-logs`, { params: taskId ? { task_id: taskId } : {} }),
  streamLogs(pid, afterId = 0) {
    const token = localStorage.getItem('token')
    const url = `${API_BASE}/projects/${pid}/generation-logs/stream?after_id=${afterId}&token=${token}`
    return new EventSource(url)
  }
}
