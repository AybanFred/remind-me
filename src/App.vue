<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import { useFocusStore } from '@/stores/focus'
import { useTasksStore } from '@/stores/tasks'
import { useTimeStore } from '@/stores/time'
import { useRemindersStore } from '@/stores/reminders'
import { useNotificationsStore } from '@/stores/notifications'
import AppShell from '@/components/AppShell.vue'
import ToastHost from '@/components/ToastHost.vue'

const auth = useAuthStore()
const appearance = useAppearanceStore()
const categories = useCategoriesStore()
const tasks = useTasksStore()
const focus = useFocusStore()
const time = useTimeStore()
const reminders = useRemindersStore()
const notifications = useNotificationsStore()
const route = useRoute()

// Reminders run on every page, so they are started here (the root component)
// rather than inside one view. They only run while someone is logged in.
// Watching the user id (not the whole user object) matters: saving a profile change gives us a
// new user object, and that must not restart the reminders or reload the timer.
watch(
  () => auth.user?.id,
  (id) => {
    if (id) {
      appearance.syncFromAccount() // colours and font saved on your account
      categories.fetch() // your own task categories
      notifications.load(id) // the bell's list, before reminders start adding to it
      reminders.start()
      focus.hydrate() // bring back a timer that was running before a refresh
      time.fetchAll() // a time-tracker entry may still be running (maybe started on another device)
    } else {
      reminders.stop()
      notifications.clear()
      tasks.$reset() // don't keep the previous account's data in memory after logout
      focus.clear()
      time.clear()
      categories.clear()
    }
  },
  { immediate: true }
)

// Re-check whenever tasks change, e.g. you just added a task due in 5 minutes.
watch(() => tasks.tasks, () => reminders.check(), { deep: true })
</script>

<template>
  <!-- Logged-in pages get the top bar and tab bar; the login page stands alone. -->
  <AppShell v-if="route.meta.requiresAuth && auth.user">
    <RouterView />
  </AppShell>
  <RouterView v-else />

  <ToastHost />
</template>
