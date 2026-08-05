import { ref, watch } from 'vue'

const THEME_KEY = 'theme'

function loadTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'light' ? 'light' : 'dark'
}

/**
 * 主题状态:默认暗色,localStorage 持久化,切换时同步 html.dark class
 */
export function useTheme() {
  const theme = ref<'dark' | 'light'>(loadTheme())

  watch(theme, (t) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    localStorage.setItem(THEME_KEY, t)
  })

  return { theme }
}
