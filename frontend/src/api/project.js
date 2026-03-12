import client from './client'

export const projectApi = {
  list: () => client.get('/projects'),
  get: (id) => client.get(`/projects/${id}`),
  create: (data) => client.post('/projects', data),
  update: (id, data) => client.put(`/projects/${id}`, data),
  remove: (id) => client.delete(`/projects/${id}`)
}
