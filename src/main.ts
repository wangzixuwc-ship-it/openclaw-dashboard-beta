import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 设置 dayjs 中文 locale
dayjs.locale('zh-cn')

import App from './App.vue'
import router from './router'

function isLoopbackHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
}

const TRUSTED_HTTPS_ORIGIN =
  import.meta.env.VITE_OPENCLAW_TRUSTED_HTTPS_ORIGIN || 'https://example-host.ts.net'

function installSmartVoiceEntry(): void {
  if (window.location.protocol !== 'http:') return
  if (isLoopbackHost(window.location.hostname)) return

  const port = window.location.port || '31021'
  if (port !== '31021') return

  const target = `${TRUSTED_HTTPS_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(target)
}

installSmartVoiceEntry()

// 初始主题：按用户保存的偏好决定 Element 的 dark 模式（useTheme 接管后续切换）
import './style.css'
if (localStorage.getItem('openclaw-theme') !== 'light') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
const pinia = createPinia()

// Register all Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

app.mount('#app')

const APP_CHROME_TITLE_TEXT = 'OpenClaw 工作台 2.0'

function normalizeInjectedTitlebarText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function findInjectedTitlebarHost(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element
  let best: HTMLElement | null = null

  while (node && node !== document.body) {
    const rect = node.getBoundingClientRect()
    if (
      rect.top <= 80 &&
      rect.bottom >= 0 &&
      rect.height > 0 &&
      rect.height <= 96 &&
      rect.width >= Math.min(window.innerWidth * 0.4, 480)
    ) {
      best = node
    }
    node = node.parentElement
  }

  if (best) {
    return best
  }

  let directChild: HTMLElement | null = element
  while (directChild.parentElement && directChild.parentElement !== document.body) {
    directChild = directChild.parentElement
  }

  return directChild.id === 'app' ? null : directChild
}

function hideInjectedAppTitlebar(): void {
  if (!document.body) {
    return
  }

  for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (element.closest('#app')) {
      continue
    }

    const tagName = element.tagName.toLowerCase()
    if (['script', 'style', 'link', 'meta', 'noscript'].includes(tagName)) {
      continue
    }

    const text = normalizeInjectedTitlebarText(element.textContent)
    if (!text.includes(APP_CHROME_TITLE_TEXT) || text.length > 48) {
      continue
    }

    const host = findInjectedTitlebarHost(element)
    if (!host || host.id === 'app' || host.closest('#app')) {
      continue
    }

    const rect = host.getBoundingClientRect()
    if (rect.top > 96 || rect.height > 120) {
      continue
    }

    host.setAttribute('data-openclaw-hidden-app-titlebar', 'true')
    host.style.setProperty('display', 'none', 'important')
  }
}

function installInjectedTitlebarGuard(): void {
  const run = () => requestAnimationFrame(hideInjectedAppTitlebar)

  run()
  window.addEventListener('load', run, { once: true })

  const observer = new MutationObserver(run)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  window.setTimeout(() => observer.disconnect(), 20000)
}

installInjectedTitlebarGuard()

async function uninstallDevelopmentServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
  await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))
  if ('caches' in window) {
    const keys = await caches.keys().catch(() => [])
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

// PWA Service Worker 已停用：它会缓存旧资源，导致工作台更新后卡住 / 打不开 / 需反复手动清缓存。
// 现在无论开发还是生产环境，一律主动注销旧 SW 并清空其缓存，确保每次都加载最新版本。
// 这样改版后用户只需正常刷新（首次拿到本版本时强刷一次即可），不再需要手动 unregister。
void uninstallDevelopmentServiceWorkers()
