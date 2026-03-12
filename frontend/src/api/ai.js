import client from './client'

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
  getPreview: (pid) => client.get(`/projects/${pid}/preview`)
}
