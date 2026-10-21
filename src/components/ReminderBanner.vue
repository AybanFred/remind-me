<script setup>
import { computed } from 'vue'
import { useRemindersStore } from '@/stores/reminders'
import { useTasksStore } from '@/stores/tasks'

const reminders = useRemindersStore()
const tasks = useTasksStore()

// Ask only once it's relevant: the user has at least one task with a due date.
const show = computed(() => reminders.canAsk && tasks.tasks.some((t) => t.due_at))
</script>

<template>
  <div v-if="show" role="alert" class="alert alert-info alert-soft">
    <span>Want a notification when a task is almost due or overdue?</span>
    <div class="flex gap-2">
      <button class="btn btn-sm btn-ghost" @click="reminders.dismissPrompt()">Not now</button>
      <button class="btn btn-sm btn-primary" @click="reminders.requestPermission()">
        Enable reminders
      </button>
    </div>
  </div>
</template>
