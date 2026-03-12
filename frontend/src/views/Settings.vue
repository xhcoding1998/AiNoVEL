<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import VInput from '../components/ui/VInput.vue'
import VButton from '../components/ui/VButton.vue'
import VCard from '../components/ui/VCard.vue'

const auth = useAuthStore()
const toast = useToast()

const form = ref({
  username: '',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: ''
})
const saving = ref(false)

onMounted(async () => {
  await auth.fetchProfile()
  if (auth.user) {
    form.value = {
      username: auth.user.username || '',
      ai_api_url: auth.user.ai_api_url || '',
      ai_api_key: auth.user.ai_api_key || '',
      ai_model: auth.user.ai_model || ''
    }
  }
})

async function save() {
  saving.value = true
  try {
    const { authApi } = await import('../api/auth')
    await authApi.updateProfile(form.value)
    await auth.fetchProfile()
    toast.success('保存成功')
  } catch (err) {
    toast.error('保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <h1 class="page-title">设置</h1>

    <div class="settings-sections">
      <VCard>
        <template #header>
          <div class="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
              <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke-linecap="round"/>
            </svg>
            <span>个人信息</span>
          </div>
        </template>
        <div class="form-grid">
          <VInput v-model="form.username" label="用户名" placeholder="你的用户名" />
        </div>
      </VCard>

      <VCard>
        <template #header>
          <div class="settings-card-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
              <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 8.5h4M5 11h2" stroke-linecap="round"/>
            </svg>
            <span>AI 接口配置</span>
          </div>
        </template>
        <div class="form-grid">
          <VInput v-model="form.ai_api_url" label="API 地址" placeholder="https://api.openai.com/v1" />
          <VInput v-model="form.ai_api_key" label="API Key" type="password" placeholder="sk-..." />
          <VInput v-model="form.ai_model" label="模型" placeholder="gpt-4 / deepseek-chat / 本地模型" />
        </div>
        <template #footer>
          <div class="settings-footer">
            <span class="form-hint">兼容 OpenAI 协议的任何接口 (OpenAI / DeepSeek / 本地模型等)</span>
            <VButton variant="primary" :loading="saving" @click="save">保存设置</VButton>
          </div>
        </template>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
.settings-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 640px;
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.settings-card-header svg {
  color: var(--text-tertiary);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-4);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
