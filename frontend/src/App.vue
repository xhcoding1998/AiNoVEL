<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import VToast from './components/ui/VToast.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.fetchProfile()
})
</script>

<template>
  <router-view />
  <VToast />
</template>
