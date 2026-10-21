<script setup>
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { formatDue } from '@/lib/dates'
import TaskForm from '@/components/TaskForm.vue'

const props = defineProps({ task: { type: Object, required: true } })

const tasks = useTasksStore()
const editing = ref(false)
const error = ref('')

const isDone = computed(() => props.task.status === 'done')
const isOverdue = computed(
  () => !isDone.value && props.task.due_at && new Date(props.task.due_at) < new Date()
)

const categoryLabels = { upskilling: 'Upskilling', job_hunt: 'Job hunt', daily: 'Daily' }

// Wraps a store call so a failure shows a message instead of failing silently.
async function run(action) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e.message
  }
}

async function save(changes) {
  await tasks.updateTask(props.task.id, changes)
  editing.value = false
}
</script>

<template>
  <li class="card card-border bg-base-100 p-4 shadow-sm transition hover:shadow-md">
    <TaskForm
      v-if="editing"
      :initial="task"
      :on-save="save"
      submit-label="Save"
      @cancel="editing = false"
    />

    <div v-else class="flex items-start gap-3">
      <input
        type="checkbox"
        :checked="isDone"
        class="checkbox checkbox-primary mt-1"
        @change="run(() => tasks.toggleDone(task))"
      />
      <div class="min-w-0 flex-1">
        <p class="font-medium" :class="{ 'line-through opacity-50': isDone }">{{ task.title }}</p>
        <p v-if="task.notes" class="text-base-content/70 text-sm">{{ task.notes }}</p>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span class="badge badge-soft badge-primary">
            {{ categoryLabels[task.category] }}
          </span>
          <span v-if="task.due_at" :class="isOverdue ? 'text-error font-semibold' : 'text-base-content/60'">
            {{ isOverdue ? 'Overdue · ' : 'Due ' }}{{ formatDue(task.due_at) }}
          </span>
        </div>
        <p v-if="error" class="text-error mt-1 text-sm">{{ error }}</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="editing = true">Edit</button>
      <button class="btn btn-ghost btn-sm text-error" @click="run(() => tasks.removeTask(task.id))">
        Delete
      </button>
    </div>
  </li>
</template>
