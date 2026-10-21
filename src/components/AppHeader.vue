<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemePicker from '@/components/ThemePicker.vue'

// Shared top bar for every logged-in page: title, page links, theme, logout.
const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-4">
      <h1 class="text-primary text-2xl font-bold">Remind Me</h1>
      <nav class="tabs tabs-box tabs-sm">
        <RouterLink to="/" class="tab" active-class="tab-active">List</RouterLink>
        <RouterLink to="/board" class="tab" active-class="tab-active">Board</RouterLink>
      </nav>
    </div>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <ThemePicker />
      <span class="text-base-content/60 hidden sm:inline">{{ auth.user?.email }}</span>
      <button class="btn btn-outline btn-sm" @click="logout">Log out</button>
    </div>
  </header>
</template>
