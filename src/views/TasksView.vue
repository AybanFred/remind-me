<script setup>
import { onMounted } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import TaskForm from '@/components/TaskForm.vue'
import TaskItem from '@/components/TaskItem.vue'
import AppHeader from '@/components/AppHeader.vue'

const tasks = useTasksStore()

const filters = [
  { value: 'all', label: 'All' },
  { value: 'upskilling', label: 'Upskilling' },
  { value: 'job_hunt', label: 'Job hunt' },
  { value: 'daily', label: 'Daily' }
]

onMounted(() => tasks.fetchTasks())
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 p-4">
    <AppHeader />

    <TaskForm :on-save="tasks.addTask" />

    <nav class="join">
      <button
        v-for="f in filters"
        :key="f.value"
        class="btn btn-sm join-item"
        :class="{ 'btn-primary': tasks.filter === f.value }"
        @click="tasks.filter = f.value"
      >
        {{ f.label }}
      </button>
    </nav>

    <p v-if="tasks.error" class="text-error">{{ tasks.error }}</p>
    <span v-else-if="tasks.loading" class="loading loading-spinner"></span>
    <p v-else-if="!tasks.filteredTasks.length" class="text-base-content/60">No tasks here yet.</p>

    <ul class="space-y-3">
      <TaskItem v-for="task in tasks.filteredTasks" :key="task.id" :task="task" />
    </ul>
  </div>
</template>
