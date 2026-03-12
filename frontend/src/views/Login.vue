<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import VInput from '../components/ui/VInput.vue'
import VButton from '../components/ui/VButton.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errors = ref({})

async function handleLogin() {
  errors.value = {}
  if (!email.value) { errors.value.email = '请输入邮箱'; return }
  if (!password.value) { errors.value.password = '请输入密码'; return }

  loading.value = true
  try {
    await auth.login(email.value, password.value)
    toast.success('登录成功')
    router.push('/')
  } catch (err) {
    const msg = err?.error || err?.message || '登录失败，请检查邮箱和密码'
    toast.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bg">
      <div class="auth-bg__gradient" />
    </div>
    <div class="auth-container">
      <div class="auth-header">
        <div class="auth-logo-icon">N</div>
        <h1 class="auth-logo">AI Novel</h1>
        <p class="auth-desc">智能小说创作平台</p>
      </div>
      <form class="auth-form" @submit.prevent="handleLogin">
        <VInput
          v-model="email"
          label="邮箱"
          type="email"
          placeholder="your@email.com"
          :error="errors.email"
        />
        <VInput
          v-model="password"
          label="密码"
          type="password"
          placeholder="输入密码"
          :error="errors.password"
        />
        <VButton variant="primary" block :loading="loading" @click="handleLogin">
          登录
        </VButton>
      </form>
      <div class="auth-footer">
        <span class="auth-footer__text">还没有账号？</span>
        <router-link to="/register" class="auth-footer__link">注册</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: var(--space-6);
}

.auth-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.auth-bg__gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0, 112, 243, 0.06) 0%, transparent 60%),
    var(--bg-primary);
}

.auth-container {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
}

.auth-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.auth-logo-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--text-primary);
  border-radius: var(--radius-lg);
  font-weight: 800;
  font-size: 24px;
  color: var(--bg-primary);
}

.auth-logo {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.auth-desc {
  color: var(--text-tertiary);
  font-size: 14px;
  margin-top: var(--space-1);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
}

.auth-footer {
  text-align: center;
  margin-top: var(--space-5);
  font-size: 14px;
}

.auth-footer__text {
  color: var(--text-tertiary);
}

.auth-footer__link {
  color: var(--accent-blue);
  font-weight: 500;
  margin-left: var(--space-1);
  transition: color var(--transition-fast);
}

.auth-footer__link:hover {
  color: var(--accent-blue-hover);
}
</style>
