<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Trash2, X } from 'lucide-vue-next'
import { isoToLocalInput, localInputToIso } from '@/lib/dates'
import { useCategoriesStore } from '@/stores/categories'
import { useRewardsStore } from '@/stores/rewards'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import CategoryBadge from '@/components/CategoryBadge.vue'
import SubtaskList from '@/components/SubtaskList.vue'

// A pop-up with everything about one task, all editable. Used by the Board and the Calendar.
// We take the task's id (not the task object) and look it up, so the modal always shows the
// latest version, e.g. after a subtask is ticked.
const props = defineProps({ taskId: { type: String, required: true } })
const emit = defineEmits(['close'])

const tasks = useTasksStore()
const categories = useCategoriesStore()
const rewards = useRewardsStore()
const toast = useToastStore()

const task = computed(() => tasks.tasks.find((t) => t.id === props.taskId))

const statuses = [
  { value: 'todo', label: 'To Do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' }
]

// The form starts as a copy of the task; nothing is saved until you press Save.
const form = ref({
  title: task.value?.title ?? '',
  notes: task.value?.notes ?? '',
  category: task.value?.category ?? '',
  dueAt: isoToLocalInput(task.value?.due_at),
  status: task.value?.status ?? 'todo'
})
const saving = ref(false)

const categoryOptions = computed(() => {
  const list = categories.all.map((c) => ({ key: c.key, label: c.label }))
  if (form.value.category && !categories.byKey.has(form.value.category)) {
    list.push({ key: form.value.category, label: categories.labelOf(form.value.category) })
  }
  return list
})

const formatDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

// A plain overlay rather than the browser's <dialog>: a <dialog> is drawn above everything,
// which would hide the toast messages (like "Complete task") behind it.
const titleInput = ref(null)

function close() {
  emit('close')
}
function closeOnEscape(event) {
  if (event.key === 'Escape') close()
}
onMounted(() => {
  window.addEventListener('keydown', closeOnEscape)
  titleInput.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', closeOnEscape))

async function save() {
  if (!form.value.title.trim()) return toast.error('A task needs a title.')
  const current = task.value
  const changes = {
    title: form.value.title.trim(),
    notes: form.value.notes.trim(),
    category: form.value.category,
    due_at: localInputToIso(form.value.dueAt)
  }

  // Changing the status works like dragging the card to that column: it goes to the bottom of
  // the column, and completed_at is set or cleared the same way the checkbox does it.
  const becameDone = form.value.status === 'done' && current.status !== 'done'
  if (form.value.status !== current.status) {
    const lastPosition = tasks.tasks
      .filter((t) => t.status === form.value.status)
      .reduce((max, t) => Math.max(max, t.position), -1)
    changes.status = form.value.status
    changes.position = lastPosition + 1
    changes.completed_at = form.value.status === 'done' ? new Date().toISOString() : null
  }

  saving.value = true
  try {
    await tasks.updateTask(current.id, changes)
    close()
    if (becameDone) rewards.celebrate({ category: changes.category })
    else toast.success('Task saved')
  } catch (e) {
    toast.error(`Could not save the task: ${e.message}`)
  } finally {
    saving.value = false
  }
}

function remove() {
  tasks.removeTaskWithUndo(task.value) // shows its own "Undo" toast
  close()
}
</script>

<template>
  <div
    class="modal modal-open modal-bottom sm:modal-middle"
    role="dialog"
    aria-modal="true"
    aria-label="Task details"
  >
    <div v-if="task" class="modal-box max-h-[90vh] max-w-lg space-y-4">
      <header class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <CategoryBadge :category="form.category" small />
          <p class="text-base-content/60 text-xs">
            Created {{ formatDate(task.created_at) }}
            <template v-if="task.completed_at"> · Completed {{ formatDate(task.completed_at) }}</template>
          </p>
        </div>
        <button class="btn btn-ghost btn-sm btn-square" aria-label="Close" @click="close">
          <X class="size-5" />
        </button>
      </header>

      <form id="task-modal-form" class="space-y-3" @submit.prevent="save">
        <input
          ref="titleInput"
          v-model="form.title"
          required
          maxlength="200"
          class="input input-lg w-full font-semibold"
          aria-label="Title"
        />
        <textarea v-model="form.notes" rows="3" placeholder="Notes" class="textarea w-full" aria-label="Notes" />

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-xs">
            <span class="text-base-content/60 mb-1 block">Status</span>
            <select v-model="form.status" class="select select-sm w-full">
              <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </label>
          <label class="text-xs">
            <span class="text-base-content/60 mb-1 block">Category</span>
            <select v-model="form.category" class="select select-sm w-full">
              <option v-for="c in categoryOptions" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </label>
          <label class="text-xs">
            <span class="text-base-content/60 mb-1 block">Due</span>
            <input v-model="form.dueAt" type="datetime-local" class="input input-sm w-full" />
          </label>
        </div>
      </form>

      <!-- Subtasks save as you change them; they don't wait for the Save button. -->
      <div v-if="tasks.subtasksReady" class="border-base-300 border-t pt-2">
        <SubtaskList :task="task" start-open />
      </div>

      <footer class="flex items-center justify-between gap-2 pt-2">
        <button type="button" class="btn btn-ghost btn-sm text-error" @click="remove">
          <Trash2 class="size-4" /> Delete
        </button>
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost" @click="close">Cancel</button>
          <button type="submit" form="task-modal-form" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            Save
          </button>
        </div>
      </footer>
    </div>

    <!-- Clicking the dimmed area outside closes it -->
    <div class="modal-backdrop" @click="close"></div>
  </div>
</template>
