import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@fontsource-variable/plus-jakarta-sans'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { applyTheme, getSavedTheme } from './lib/theme'
import { useAppearanceStore } from './stores/appearance'

applyTheme(getSavedTheme())

const app = createApp(App)

app.use(createPinia())

// Apply saved colours and font before the first screen is drawn
useAppearanceStore().init()

// Restore the session (including the OAuth redirect) before the router's first navigation
await useAuthStore().init()

app.use(router)

app.mount('#app')
