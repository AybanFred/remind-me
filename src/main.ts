import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())

// Restore the session (including the OAuth redirect) before the router's first navigation
await useAuthStore().init()

app.use(router)

app.mount('#app')
