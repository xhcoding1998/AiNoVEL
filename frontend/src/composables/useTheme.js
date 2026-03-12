import { ref } from 'vue'

const STORAGE_KEY = 'ainovel_theme'

export const THEME_DARK = 'dark'
export const THEME_LIGHT = 'light'

const theme = ref(
  typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) || THEME_DARK) : THEME_DARK
)

function applyTheme(value) {
  const root = document.documentElement
  if (value === THEME_LIGHT) {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}

export function useTheme() {
  const setTheme = (value) => {
    theme.value = value === THEME_LIGHT ? THEME_LIGHT : THEME_DARK
    localStorage.setItem(STORAGE_KEY, theme.value)
    applyTheme(theme.value)
  }

  return {
    theme,
    setTheme,
    applyTheme
  }
}

applyTheme(theme.value)
