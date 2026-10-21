<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useTasksStore } from '@/stores/tasks'
import { formatDue } from '@/lib/dates'
import AppHeader from '@/components/AppHeader.vue'

const tasks = useTasksStore()
const error = ref('')

const columnInfo = [
  { status: 'todo', title: 'To Do' },
  { status: 'doing', title: 'Doing' },
  { status: 'done', title: 'Done' }
]
const categoryLabels = { upskilling: 'Upskilling', job_hunt: 'Job hunt', daily: 'Daily' }

// The draggable library needs one array per column that it is allowed to reorder.
// We build those arrays from the store's task list, sorted by `position`.
const columns = reactive({ todo: [], doing: [], done: [] })

function buildColumns() {
  for (const { status } of columnInfo) {
    columns[status] = tasks.tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position || new Date(b.created_at) - new Date(a.created_at))
  }
}

// Rebuild whenever the store changes (first load, a refetch after an error, etc.)
watch(() => tasks.tasks, buildColumns, { deep: true })

onMounted(async () => {
  await tasks.fetchTasks()
  buildColumns()
})

// Runs when a card is dropped into a column (either from another column or reordered
// inside the same one). We wait one tick so the library has finished updating
// `columns[status]` with the new order, then save that column to Supabase.
async function onDrop(status) {
  await nextTick()
  error.value = ''
  try {
    await tasks.saveColumn(status, columns[status])
  } catch (e) {
    error.value = `Could not save the move: ${e.message}`
    await tasks.fetchTasks() // put the board back to what the database really has
  }
}

function isOverdue(task) {
  return task.status !== 'done' && task.due_at && new Date(task.due_at) < new Date()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 p-4">
    <AppHeader />

    <p v-if="error" class="text-error">{{ error }}</p>
    <p v-if="tasks.error" class="text-error">{{ tasks.error }}</p>
    <span v-if="tasks.loading" class="loading loading-spinner"></span>

    <div class="grid gap-4 md:grid-cols-3">
      <section v-for="col in columnInfo" :key="col.status" class="bg-base-200 rounded-box p-3">
        <h2 class="mb-3 flex items-center justify-between font-semibold">
          {{ col.title }}
          <span class="badge badge-neutral">{{ columns[col.status].length }}</span>
        </h2>

        <!-- group="tasks" is what lets cards move between the three columns -->
        <VueDraggable
          v-model="columns[col.status]"
          group="tasks"
          :animation="150"
          ghost-class="opacity-40"
          class="min-h-24 space-y-2"
          @add="onDrop(col.status)"
          @update="onDrop(col.status)"
        >
          <article
            v-for="task in columns[col.status]"
            :key="task.id"
            class="card bg-base-100 cursor-grab p-3 shadow-sm active:cursor-grabbing"
          >
            <p class="font-medium" :class="{ 'line-through opacity-50': task.status === 'done' }">
              {{ task.title }}
            </p>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span class="badge badge-soft badge-primary">{{ categoryLabels[task.category] }}</span>
              <span
                v-if="task.due_at"
                :class="isOverdue(task) ? 'text-error font-semibold' : 'text-base-content/60'"
              >
                {{ isOverdue(task) ? 'Overdue · ' : '' }}{{ formatDue(task.due_at) }}
              </span>
            </div>
          </article>
        </VueDraggable>
      </section>
    </div>
  </div>
</template>
