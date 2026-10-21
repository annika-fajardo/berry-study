import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/newsreader/latin-600.css'
import '@fontsource/inter-tight/latin-400.css'
import '@fontsource/inter-tight/latin-500.css'
import '@fontsource/inter-tight/latin-600.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/app.css'
import './styles/cat.css'
import { App } from './App'
import { initStore } from './store/store'

async function boot() {
  await initStore()
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
  if (!__SINGLE__ && 'serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register')
    const { toast } = await import('./lib/events')
    // autoUpdate + skipWaiting means a new build takes over on its own; the toast is for the case
    // where the page is open while it lands, so she is never left looking at the old one.
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { toast('New version available.', { actionLabel: 'Reload', action: () => void updateSW(true), ms: 20000 }) },
      onRegisteredSW(_url, reg) {
        if (!reg) return
        const check = () => { if (navigator.onLine) void reg.update() }
        setInterval(check, 30 * 60 * 1000)
        window.addEventListener('focus', check)
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
      },
    })
  }
}
boot()
