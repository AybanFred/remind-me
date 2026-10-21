<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, ListChecks, Pencil, Plus, X } from 'lucide-vue-next'
import { useRewardsStore } from '@/stores/rewards'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'

// An optional checklist inside a task. A task with no subtasks just shows a small "Add subtasks" button.
const props = defineProps({
  task: { type: Object, required: true },
  startOpen: { type: Boolean, default: false } // the task modal shows the checklist straight away
})

const tasks = useTasksStore()
const rewards = useRewardsStore()
const toast = useToastStore()

const open = ref(props.startOpen)
const newTitle = ref('')
const renamingId = ref(null)
const renameValue = ref('')

// Puts the cursor in the rename box as soon as it appears.
const vFocus = { mounted: (el) => el.focus() }

const subtasks = computed(() => props.task.subtasks ?? [])
const doneCount = computed(() => subtasks.value.filter((s) => s.done).length)

async function add() {
  if (!newTitle.value.trim()) return
  try {
    await tasks.addSubtask(props.task, newTitle.value)
    newTitle.value = ''
  } catch (e) {
    toast.error(`Could not add the subtask: ${e.message}`)
  }
}

async function toggle(subtask) {
  try {
    await tasks.toggleSubtask(subtask)
  } catch (e) {
    return toast.error(`Could not update the subtask: ${e.message}`)
  }

  // When the last box gets ticked, offer to finish the whole task (never done automatically).
  const allDone = subtasks.value.length > 0 && doneCount.value === subtasks.value.length
  if (allDone && props.task.status !== 'done') {
    toast.show('All subtasks are done.', {
      duration: 7000,
      action: {
        label: 'Complete task',
        handler: async () => {
          try {
            await tasks.toggleDone(props.task)
            rewards.celebrate({ category: props.task.category })
          } catch (e) {
            toast.error(`Could not complete the task: ${e.message}`)
          }
        }
      }
    })
  }
}

function startRename(subtask) {
  renamingId.value = subtask.id
  renameValue.value = subtask.title
}

async function saveRename(subtask) {
  if (renamingId.value !== subtask.id) return // already handled (Enter, then the box lost focus)
  renamingId.value = null
  const title = renameValue.value.trim()
  if (!title || title === subtask.title) return
  try {
    await tasks.renameSubtask(subtask, title)
  } catch (e) {
    toast.error(`Could not rename the subtask: ${e.message}`)
  }
}

async function remove(subtask) {
  try {
    await tasks.removeSubtask(props.task, subtask)
  } catch (e) {
    toast.error(`Could not delete the subtask: ${e.message}`)
  }
}
</script>

<template>
  <div class="mt-2">
    <button
      class="btn btn-ghost btn-xs -ml-2 gap-1.5"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ListChecks class="size-3.5" />
      <span v-if="subtasks.length">{{ doneCount }}/{{ subtasks.length }} subtasks</span>
      <span v-else>Add subtasks</span>
      <ChevronDown class="size-3.5 transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <progress
      v-if="subtasks.length"
      class="progress progress-primary mt-1 h-1 w-full"
      :value="doneCount"
      :max="subtasks.length"
      :aria-label="`${doneCount} of ${subtasks.length} subtasks done`"
    ></progress>

    <div v-if="open" class="mt-2 space-y-2">
      <ul v-if="subtasks.length" class="space-y-1">
        <li
          v-for="s in subtasks"
          :key="s.id"
          class="bg-base-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
        >
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            :checked="s.done"
            :aria-label="`Mark ${s.title} as ${s.done ? 'not done' : 'done'}`"
            @change="toggle(s)"
          />

          <input
            v-if="renamingId === s.id"
            v-model="renameValue"
            v-focus
            maxlength="120"
            class="input input-sm w-full"
            @keydown.enter.prevent="saveRename(s)"
            @keydown.esc="renamingId = null"
            @blur="saveRename(s)"
          />
          <template v-else>
            <span class="min-w-0 flex-1 wrap-break-word" :class="{ 'text-base-content/50 line-through': s.done }">
              {{ s.title }}
            </span>
            <button class="btn btn-ghost btn-square btn-xs" aria-label="Rename subtask" @click="startRename(s)">
              <Pencil class="size-3.5" />
            </button>
            <button class="btn btn-ghost btn-square btn-xs text-error" aria-label="Delete subtask" @click="remove(s)">
              <X class="size-3.5" />
            </button>
          </template>
        </li>
      </ul>

      <form class="flex gap-2" @submit.prevent="add">
        <input v-model="newTitle" maxlength="120" placeholder="Add a subtask" class="input input-sm w-full" />
        <button class="btn btn-sm btn-primary btn-square" aria-label="Add subtask"><Plus class="size-4" /></button>
      </form>
    </div>
  </div>
</template>
