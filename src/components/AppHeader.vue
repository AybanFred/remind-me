<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFocusStore } from '@/stores/focus'
import { useRemindersStore } from '@/stores/reminders'
import ThemePicker from '@/components/ThemePicker.vue'

// Shared top bar for every logged-in page: title, page links, theme, logout.
const auth = useAuthStore()
const focus = useFocusStore()
const reminders = useRemindersStore()
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
        <RouterLink to="/focus" class="tab" active-class="tab-active">Focus</RouterLink>
        <RouterLink to="/dashboard" class="tab" active-class="tab-active">Stats</RouterLink>
      </nav>
    </div>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <!-- Shows the running timer on every page, and links back to the Focus page -->
      <RouterLink v-if="focus.running" to="/focus" class="badge badge-primary badge-lg tabular-nums">
        {{ focus.display }}
      </RouterLink>
      <!-- On/off switch, only once the browser has granted permission -->
      <label v-if="reminders.permission === 'granted'" class="flex cursor-pointer items-center gap-2">
        <span>Reminders</span>
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          :checked="reminders.enabled"
          @change="reminders.setEnabled($event.target.checked)"
        />
      </label>
      <button v-if="reminders.permission === 'granted'" class="btn btn-ghost btn-xs" @click="reminders.sendTest()">
        Test
      </button>
      <ThemePicker />
      <span class="text-base-content/60 hidden sm:inline">{{ auth.user?.email }}</span>
      <button class="btn btn-outline btn-sm" @click="logout">Log out</button>
    </div>
  </header>
</template>
