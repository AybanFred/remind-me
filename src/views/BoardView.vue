<script setup>
import { nextTick, onMounted, reactive, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { CalendarClock } from 'lucide-vue-next'
import { useRewardsStore } from '@/stores/rewards'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { categories } from '@/lib/categories'
import { formatDue } from '@/lib/dates'

const tasks = useTasksStore()
const rewards = useRewardsStore()
const toast = useToastStore()

const columnInfo = [
  { status: 'todo', title: 'To Do', dot: 'bg-base-content/40' },
  { status: 'doing', title: 'Doing', dot: 'bg-primary' },
  { status: 'done', title: 'Done', dot: 'bg-success' }
]

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
  try {
    const { completed } = await tasks.saveColumn(status, columns[status])
    // A card dropped into Done is a finished task, so celebrate (once, even if several moved).
    if (completed.length) rewards.celebrate({ category: completed[0].category })
  } catch (e) {
    toast.error(`Could not save the move: ${e.message}`)
    await tasks.fetchTasks() // put the board back to what the database really has
  }
}

function isOverdue(task) {
  return task.status !== 'done' && task.due_at && new Date(task.due_at) < new Date()
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="tasks.error" class="alert alert-error alert-soft">{{ tasks.error }}</p>

    <p class="text-base-content/60 text-sm md:hidden">
      Swipe sideways for the other columns. Press and hold a card to drag it.
    </p>

    <!-- Loading placeholders -->
    <div v-if="tasks.loading && !tasks.tasks.length" class="grid gap-4 md:grid-cols-3">
      <div v-for="n in 3" :key="n" class="skeleton h-64"></div>
    </div>

    <!-- On phones the columns sit side by side and you swipe between them; on desktop they share the row. -->
    <div
      v-else
      class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
    >
      <section
        v-for="col in columnInfo"
        :key="col.status"
        class="bg-base-200 rounded-box min-w-[85%] snap-center p-3 md:min-w-0"
      >
        <h2 class="mb-3 flex items-center gap-2 font-semibold">
          <span class="size-2.5 rounded-full" :class="col.dot"></span>
          {{ col.title }}
          <span class="badge badge-neutral badge-sm ml-auto">{{ columns[col.status].length }}</span>
        </h2>

        <!-- group="tasks" lets cards move between the three columns.
             On touch screens a short press-and-hold starts the drag, so normal scrolling still works. -->
        <VueDraggable
          v-model="columns[col.status]"
          group="tasks"
          :animation="150"
          :delay="150"
          :delay-on-touch-only="true"
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
            <p
              class="font-medium wrap-break-word"
              :class="{ 'line-through opacity-50': task.status === 'done' }"
            >
              {{ task.title }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span class="badge badge-soft badge-sm" :class="categories[task.category].badge">
                {{ categories[task.category].label }}
              </span>
              <span
                v-if="task.due_at"
                class="flex items-center gap-1"
                :class="isOverdue(task) ? 'text-error font-semibold' : 'text-base-content/60'"
              >
                <CalendarClock class="size-3.5" />
                {{ isOverdue(task) ? 'Overdue · ' : '' }}{{ formatDue(task.due_at) }}
              </span>
            </div>
          </article>
        </VueDraggable>

        <p
          v-if="!columns[col.status].length"
          class="text-base-content/40 pointer-events-none -mt-20 pb-8 text-center text-sm"
        >
          Drop tasks here
        </p>
      </section>
    </div>
  </div>
</template>
