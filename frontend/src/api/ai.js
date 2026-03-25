import client from './client'

export const aiApi = {
  generateAll: (pid, prompt) => client.post(`/projects/${pid}/generate-all`, { prompt }),
  continueGeneration: (pid) => client.post(`/projects/${pid}/continue-generation`),
  stopGeneration: (pid) => client.post(`/projects/${pid}/stop-generation`),
  generateSection: (pid, section, prompt) => client.post(`/projects/${pid}/generate-section`, { section, prompt }),
  regenerateFrom: (pid, afterStep) => client.post(`/projects/${pid}/regenerate-from`, { after_step: afterStep }),
  getGenerationStatus: (pid) => client.get(`/projects/${pid}/generation-status`),
  getTasks: (pid) => client.get(`/projects/${pid}/ai-tasks`),
  getTask: (pid, tid) => client.get(`/projects/${pid}/ai-tasks/${tid}`),
  compileMaterial: (pid) => client.post(`/projects/${pid}/material/compile`),
  getMaterial: (pid) => client.get(`/projects/${pid}/material`),
  generateVolumeChapters: (pid, volumeId, prompt) => client.post(`/projects/${pid}/generate-volume-chapters`, { volume_id: volumeId, prompt }),
  generateChapterContent: (pid, chapterId) => client.post(`/projects/${pid}/generate-chapter-content`, { chapter_id: chapterId }),
  getPreview: (pid) => client.get(`/projects/${pid}/preview`),
  generateSingleItem: (pid, itemType, context, userData) => client.post(`/projects/${pid}/generate-single-item`, { item_type: itemType, context, user_data: userData }),
  regeneratePlotDevices: (pid) => client.post(`/projects/${pid}/regenerate-plot-devices`),
  generateStoryboards: (pid, chapterId) => client.post(`/projects/${pid}/generate-storyboards`, { chapter_id: chapterId }),
  saveStoryboards: (pid, chapterId, storyboards) => client.put(`/projects/${pid}/chapters/${chapterId}/storyboards`, { storyboards }),
  getGenerationLogs: (pid, taskId, afterId) => {
    const params = {}
    if (taskId) params.task_id = taskId
    if (afterId) params.after_id = afterId
    return client.get(`/projects/${pid}/generation-logs`, { params })
  }
}
