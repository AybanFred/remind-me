<script setup>
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useRemindersStore } from '@/stores/reminders'

const auth = useAuthStore()
const tasks = useTasksStore()
const reminders = useRemindersStore()

// Reminders run on every page, so they are started here (the root component)
// rather than inside one view. They only run while someone is logged in.
watch(
  () => auth.user,
  (user) => {
    if (user) {
      reminders.start()
    } else {
      reminders.stop()
      tasks.$reset() // don't keep the previous account's tasks in memory after logout
    }
  },
  { immediate: true }
)

// Re-check whenever tasks change, e.g. you just added a task due in 5 minutes.
watch(() => tasks.tasks, () => reminders.check(), { deep: true })
</script>

<template>
  <RouterView />
</template>
