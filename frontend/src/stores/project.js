import { defineStore } from 'pinia'
import { ref } from 'vue'
import { projectApi } from '../api/project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)

  async function fetchProjects() {
    loading.value = true
    try {
      const res = await projectApi.list()
      projects.value = res.projects
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id) {
    loading.value = true
    try {
      const res = await projectApi.get(id)
      currentProject.value = res.project
    } finally {
      loading.value = false
    }
  }

  async function createProject(data) {
    const res = await projectApi.create(data)
    projects.value.unshift(res.project)
    return res.project
  }

  async function updateProject(id, data) {
    const res = await projectApi.update(id, data)
    currentProject.value = res.project
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value[idx] = res.project
    return res.project
  }

  async function deleteProject(id) {
    await projectApi.remove(id)
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) currentProject.value = null
  }

  return {
    projects,
    currentProject,
    loading,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject
  }
})
