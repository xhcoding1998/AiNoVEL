import { defineStore } from 'pinia'
import { ref } from 'vue'
import { novelApi } from '../api/novel'

export const useNovelStore = defineStore('novel', () => {
  const basicInfo = ref(null)
  const worldBuilding = ref(null)
  const characters = ref([])
  const relations = ref([])
  const plotControl = ref(null)
  const volumes = ref([])
  const chapters = ref([])
  const plotDevices = ref([])
  const writingStyle = ref(null)
  const loading = ref(false)

  async function fetchBasicInfo(projectId) {
    const res = await novelApi.getBasicInfo(projectId)
    basicInfo.value = res.data
  }

  async function saveBasicInfo(projectId, data) {
    const res = await novelApi.saveBasicInfo(projectId, data)
    basicInfo.value = res.data
  }

  async function fetchWorldBuilding(projectId) {
    const res = await novelApi.getWorldBuilding(projectId)
    worldBuilding.value = res.data
  }

  async function saveWorldBuilding(projectId, data) {
    const res = await novelApi.saveWorldBuilding(projectId, data)
    worldBuilding.value = res.data
  }

  async function fetchCharacters(projectId) {
    const res = await novelApi.getCharacters(projectId)
    characters.value = res.data
  }

  async function saveCharacter(projectId, data) {
    const res = await novelApi.saveCharacter(projectId, data)
    const idx = characters.value.findIndex(c => c.id === res.data.id)
    if (idx !== -1) characters.value[idx] = res.data
    else characters.value.push(res.data)
    return res.data
  }

  async function deleteCharacter(projectId, characterId) {
    await novelApi.deleteCharacter(projectId, characterId)
    characters.value = characters.value.filter(c => c.id !== characterId)
  }

  async function fetchRelations(projectId) {
    const res = await novelApi.getRelations(projectId)
    relations.value = res.data
  }

  async function saveRelation(projectId, data) {
    const res = await novelApi.saveRelation(projectId, data)
    const idx = relations.value.findIndex(r => r.id === res.data.id)
    if (idx !== -1) relations.value[idx] = res.data
    else relations.value.push(res.data)
    return res.data
  }

  async function deleteRelation(projectId, relationId) {
    await novelApi.deleteRelation(projectId, relationId)
    relations.value = relations.value.filter(r => r.id !== relationId)
  }

  async function fetchPlotControl(projectId) {
    const res = await novelApi.getPlotControl(projectId)
    plotControl.value = res.data
  }

  async function savePlotControl(projectId, data) {
    const res = await novelApi.savePlotControl(projectId, data)
    plotControl.value = res.data
  }

  async function fetchVolumes(projectId) {
    const res = await novelApi.getVolumes(projectId)
    volumes.value = res.data
  }

  async function saveVolume(projectId, data) {
    const res = await novelApi.saveVolume(projectId, data)
    const idx = volumes.value.findIndex(v => v.id === res.data.id)
    if (idx !== -1) volumes.value[idx] = res.data
    else volumes.value.push(res.data)
    return res.data
  }

  async function deleteVolume(projectId, volumeId) {
    await novelApi.deleteVolume(projectId, volumeId)
    volumes.value = volumes.value.filter(v => v.id !== volumeId)
  }

  async function fetchChapters(projectId, volumeId) {
    const res = await novelApi.getChapters(projectId, volumeId)
    chapters.value = res.data
  }

  async function saveChapter(projectId, data) {
    const res = await novelApi.saveChapter(projectId, data)
    const idx = chapters.value.findIndex(c => c.id === res.data.id)
    if (idx !== -1) chapters.value[idx] = res.data
    else chapters.value.push(res.data)
    return res.data
  }

  async function deleteChapter(projectId, chapterId) {
    await novelApi.deleteChapter(projectId, chapterId)
    chapters.value = chapters.value.filter(c => c.id !== chapterId)
  }

  async function fetchPlotDevices(projectId) {
    const res = await novelApi.getPlotDevices(projectId)
    plotDevices.value = res.data
  }

  async function savePlotDevice(projectId, data) {
    const res = await novelApi.savePlotDevice(projectId, data)
    const idx = plotDevices.value.findIndex(d => d.id === res.data.id)
    if (idx !== -1) plotDevices.value[idx] = res.data
    else plotDevices.value.push(res.data)
    return res.data
  }

  async function fetchWritingStyle(projectId) {
    const res = await novelApi.getWritingStyle(projectId)
    writingStyle.value = res.data
  }

  async function saveWritingStyle(projectId, data) {
    const res = await novelApi.saveWritingStyle(projectId, data)
    writingStyle.value = res.data
  }

  function clearAll() {
    basicInfo.value = null
    worldBuilding.value = null
    characters.value = []
    relations.value = []
    plotControl.value = null
    volumes.value = []
    chapters.value = []
    plotDevices.value = []
    writingStyle.value = null
  }

  return {
    basicInfo, worldBuilding, characters, relations,
    plotControl, volumes, chapters, plotDevices, writingStyle, loading,
    fetchBasicInfo, saveBasicInfo,
    fetchWorldBuilding, saveWorldBuilding,
    fetchCharacters, saveCharacter, deleteCharacter,
    fetchRelations, saveRelation, deleteRelation,
    fetchPlotControl, savePlotControl,
    fetchVolumes, saveVolume, deleteVolume,
    fetchChapters, saveChapter, deleteChapter, deleteChapter,
    fetchPlotDevices, savePlotDevice,
    fetchWritingStyle, saveWritingStyle,
    clearAll
  }
})
