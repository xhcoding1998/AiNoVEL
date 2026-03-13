import client from './client'

export const novelApi = {
  getBasicInfo: (pid) => client.get(`/projects/${pid}/basic-info`),
  saveBasicInfo: (pid, data) => client.put(`/projects/${pid}/basic-info`, data),

  getWorldBuilding: (pid) => client.get(`/projects/${pid}/world-building`),
  saveWorldBuilding: (pid, data) => client.put(`/projects/${pid}/world-building`, data),

  getCharacters: (pid) => client.get(`/projects/${pid}/characters`),
  saveCharacter: (pid, data) =>
    data.id
      ? client.put(`/projects/${pid}/characters/${data.id}`, data)
      : client.post(`/projects/${pid}/characters`, data),
  deleteCharacter: (pid, cid) => client.delete(`/projects/${pid}/characters/${cid}`),

  getRelations: (pid) => client.get(`/projects/${pid}/relations`),
  saveRelation: (pid, data) =>
    data.id
      ? client.put(`/projects/${pid}/relations/${data.id}`, data)
      : client.post(`/projects/${pid}/relations`, data),
  deleteRelation: (pid, rid) => client.delete(`/projects/${pid}/relations/${rid}`),

  getPlotControl: (pid) => client.get(`/projects/${pid}/plot-control`),
  savePlotControl: (pid, data) => client.put(`/projects/${pid}/plot-control`, data),

  getVolumes: (pid) => client.get(`/projects/${pid}/volumes`),
  saveVolume: (pid, data) =>
    data.id
      ? client.put(`/projects/${pid}/volumes/${data.id}`, data)
      : client.post(`/projects/${pid}/volumes`, data),
  deleteVolume: (pid, vid) => client.delete(`/projects/${pid}/volumes/${vid}`),

  getChapters: (pid, vid) => client.get(`/projects/${pid}/volumes/${vid}/chapters`),
  saveChapter: (pid, data) =>
    data.id
      ? client.put(`/projects/${pid}/chapters/${data.id}`, data)
      : client.post(`/projects/${pid}/chapters`, data),
  deleteChapter: (pid, chid) => client.delete(`/projects/${pid}/chapters/${chid}`),

  getPlotDevices: (pid) => client.get(`/projects/${pid}/plot-devices`),
  savePlotDevice: (pid, data) =>
    data.id
      ? client.put(`/projects/${pid}/plot-devices/${data.id}`, data)
      : client.post(`/projects/${pid}/plot-devices`, data),

  getWritingStyle: (pid) => client.get(`/projects/${pid}/writing-style`),
  saveWritingStyle: (pid, data) => client.put(`/projects/${pid}/writing-style`, data)
}
