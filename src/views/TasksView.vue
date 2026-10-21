<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Inbox, Settings2, Sparkles } from 'lucide-vue-next'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { useCategoriesStore } from '@/stores/categories'
import TaskViewTabs from '@/components/TaskViewTabs.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskItem from '@/components/TaskItem.vue'
import ReminderBanner from '@/components/ReminderBanner.vue'

const tasks = useTasksStore()
const toast = useToastStore()
const form = ref(null)

const categories = useCategoriesStore()

const filters = computed(() => [
  { value: 'all', label: 'All' },
  ...categories.all.map((c) => ({ value: c.key, label: c.label }))
])

async function addTask(payload) {
  await tasks.addTask(payload)
  toast.success('Task added')
}

// Keyboard shortcut: press N anywhere (outside a text box) to jump to "add task".
function onKeydown(e) {
  if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
  e.preventDefault()
  form.value?.focus()
}

onMounted(() => {
  tasks.fetchTasks()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="space-y-5">
    <TaskViewTabs />

    <ReminderBanner />

    <TaskForm ref="form" :on-save="addTask" />

    <nav class="join max-w-full overflow-x-auto" aria-label="Filter by category">
      <button
        v-for="f in filters"
        :key="f.value"
        class="btn btn-sm join-item"
        :class="{ 'btn-primary': tasks.filter === f.value }"
        @click="tasks.filter = f.value"
      >
        {{ f.label }}
      </button>
      <RouterLink
        v-if="categories.ready"
        to="/settings#categories"
        class="btn btn-sm join-item btn-ghost"
        aria-label="Manage categories"
        title="Manage categories"
      >
        <Settings2 class="size-4" />
      </RouterLink>
    </nav>

    <p v-if="tasks.error" class="alert alert-error alert-soft">{{ tasks.error }}</p>

    <!-- Loading: grey placeholder cards in the shape of the real ones -->
    <div v-else-if="tasks.loading && !tasks.tasks.length" class="space-y-3">
      <div v-for="n in 3" :key="n" class="skeleton h-20 w-full"></div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!tasks.filteredTasks.length"
      class="flex flex-col items-center gap-2 py-12 text-center"
    >
      <Inbox class="text-base-content/30 size-12" />
      <p class="font-medium">
        {{ tasks.filter === 'all' ? 'Nothing here yet' : 'No tasks in this category' }}
      </p>
      <p class="text-base-content/60 max-w-xs text-sm">
        Add a task above. Press <kbd class="kbd kbd-sm">N</kbd> any time to jump to the form.
      </p>
      <RouterLink v-if="tasks.filter === 'all'" to="/coach" class="btn btn-ghost btn-sm mt-2">
        <Sparkles class="size-4" /> Let the Coach break a goal into tasks
      </RouterLink>
    </div>

    <ul class="space-y-3">
      <TaskItem v-for="task in tasks.filteredTasks" :key="task.id" :task="task" />
    </ul>
  </div>
</template>
