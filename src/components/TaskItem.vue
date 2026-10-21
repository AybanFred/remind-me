<script setup>
import { computed, ref } from 'vue'
import { CalendarClock, Pencil, Trash2 } from 'lucide-vue-next'
import { useRewardsStore } from '@/stores/rewards'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { formatDue } from '@/lib/dates'
import CategoryBadge from '@/components/CategoryBadge.vue'
import SubtaskList from '@/components/SubtaskList.vue'
import TaskForm from '@/components/TaskForm.vue'

const props = defineProps({ task: { type: Object, required: true } })

const tasks = useTasksStore()
const rewards = useRewardsStore()
const toast = useToastStore()
const editing = ref(false)

const isDone = computed(() => props.task.status === 'done')
const isOverdue = computed(
  () => !isDone.value && props.task.due_at && new Date(props.task.due_at) < new Date()
)

async function toggle(event) {
  // The confetti starts where the checkbox is on screen (as a fraction of the window size).
  const box = event.target.getBoundingClientRect()
  const origin = {
    x: (box.left + box.width / 2) / window.innerWidth,
    y: (box.top + box.height / 2) / window.innerHeight
  }
  try {
    await tasks.toggleDone(props.task)
    if (props.task.status === 'done') rewards.celebrate({ category: props.task.category, origin })
  } catch (e) {
    toast.error(`Could not update the task: ${e.message}`)
  }
}

async function save(changes) {
  await tasks.updateTask(props.task.id, changes)
  editing.value = false
  toast.success('Task saved')
}
</script>

<template>
  <li class="card card-border bg-base-100 p-4 transition-colors" :class="{ 'opacity-70': isDone }">
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
        class="checkbox checkbox-primary mt-0.5"
        :aria-label="isDone ? 'Mark as not done' : 'Mark as done'"
        @change="toggle"
      />
      <div class="min-w-0 flex-1">
        <p class="font-medium wrap-break-word" :class="{ 'line-through': isDone }">{{ task.title }}</p>
        <p v-if="task.notes" class="text-base-content/70 mt-0.5 text-sm wrap-break-word">{{ task.notes }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <CategoryBadge :category="task.category" />
          <span
            v-if="task.due_at"
            class="flex items-center gap-1"
            :class="isOverdue ? 'text-error font-semibold' : 'text-base-content/60'"
          >
            <CalendarClock class="size-3.5" />
            {{ isOverdue ? 'Overdue · ' : '' }}{{ formatDue(task.due_at) }}
          </span>
        </div>

        <SubtaskList v-if="tasks.subtasksReady" :task="task" />
      </div>
      <div class="flex shrink-0">
        <button class="btn btn-ghost btn-square btn-sm" aria-label="Edit task" @click="editing = true">
          <Pencil class="size-4" />
        </button>
        <button
          class="btn btn-ghost btn-square btn-sm text-error"
          aria-label="Delete task"
          @click="tasks.removeTaskWithUndo(task)"
        >
          <Trash2 class="size-4" />
        </button>
      </div>
    </div>
  </li>
</template>
