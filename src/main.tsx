import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fraunces/latin-600-italic.css'
import '@fontsource/fraunces/latin-700-italic.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './styles/app.css'
import { App } from './App'
import { initStore } from './store/store'

async function boot() {
  await initStore()
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
  if (!__SINGLE__ && 'serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }
}
boot()
