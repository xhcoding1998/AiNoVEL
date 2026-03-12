import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  function addToast(message, type = 'info', duration = 3000) {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(msg) { return addToast(msg, 'success') }
  function error(msg) { return addToast(msg, 'error', 5000) }
  function info(msg) { return addToast(msg, 'info') }
  function warning(msg) { return addToast(msg, 'warning', 4000) }

  return { toasts, addToast, removeToast, success, error, info, warning }
}
