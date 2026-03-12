import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || '')

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(userData, tokenValue) {
    user.value = userData
    token.value = tokenValue
    localStorage.setItem('token', tokenValue)
  }

  function clearAuth() {
    user.value = null
    token.value = ''
    localStorage.removeItem('token')
  }

  async function login(email, password) {
    const res = await authApi.login({ email, password })
    setAuth(res.user, res.token)
    return res
  }

  async function register(username, email, password) {
    const res = await authApi.register({ username, email, password })
    setAuth(res.user, res.token)
    return res
  }

  async function fetchProfile() {
    if (!token.value) return
    try {
      const res = await authApi.profile()
      user.value = res.user
    } catch {
      clearAuth()
    }
  }

  function logout() {
    clearAuth()
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    register,
    fetchProfile,
    logout,
    setAuth,
    clearAuth
  }
})
