<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, LogOut, Settings } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useRemindersStore } from '@/stores/reminders'
import ThemePicker from '@/components/ThemePicker.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const auth = useAuthStore()
const reminders = useRemindersStore()
const route = useRoute()
const router = useRouter()

// Whether the menu is open is our own on/off switch.
// (The old version relied on the browser's "focus" and closed itself whenever the theme
// dropdown inside it took the focus. A plain on/off switch has no such problem.)
const open = ref(false)
const root = ref(null)

function closeOnOutsideClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
function closeOnEscape(event) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})

// Going to another page closes the menu.
watch(() => route.fullPath, () => (open.value = false))

async function logout() {
  open.value = false
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="btn btn-ghost btn-circle"
      aria-label="Account menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <UserAvatar size="sm" />
    </button>

    <div
      v-if="open"
      class="bg-base-100 border-base-300 rounded-box absolute top-full right-0 z-40 mt-2 w-72 space-y-3 border p-4 shadow-lg"
      role="menu"
    >
      <div class="flex items-center gap-3">
        <UserAvatar size="md" />
        <div class="min-w-0">
          <p class="truncate font-semibold">{{ auth.displayName }}</p>
          <p class="text-base-content/60 truncate text-xs">{{ auth.user?.email }}</p>
        </div>
      </div>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Theme</span>
        <ThemePicker />
      </label>

      <RouterLink to="/settings" class="btn btn-ghost btn-sm w-full justify-start">
        <Settings class="size-4" /> Profile and appearance
      </RouterLink>

      <template v-if="reminders.permission === 'granted'">
        <label class="flex cursor-pointer items-center justify-between text-sm font-medium">
          <span class="flex items-center gap-2"><Bell class="size-4" /> Reminders</span>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            :checked="reminders.enabled"
            @change="reminders.setEnabled($event.target.checked)"
          />
        </label>
        <button class="btn btn-ghost btn-sm w-full justify-start" @click="reminders.sendTest()">
          Send a test notification
        </button>
      </template>

      <button class="btn btn-outline btn-sm w-full" @click="logout">
        <LogOut class="size-4" /> Log out
      </button>
    </div>
  </div>
</template>
