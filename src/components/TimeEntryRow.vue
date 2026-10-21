<script setup>
import { computed, ref } from 'vue'
import { Pencil, Play, Trash2 } from 'lucide-vue-next'
import { isoToLocalInput, localInputToIso } from '@/lib/dates'
import { durationSeconds, formatClock, formatHours } from '@/lib/time'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'

const props = defineProps({ entry: { type: Object, required: true } })

const time = useTimeStore()
const toast = useToastStore()

const editing = ref(false)
const form = ref({})

const isRunning = computed(() => !props.entry.ended_at)
const project = computed(() => time.projectById.get(props.entry.project_id))
const task = computed(() => time.taskById.get(props.entry.task_id))

const duration = computed(() =>
  isRunning.value ? formatClock(durationSeconds(props.entry, time.now)) : formatHours(durationSeconds(props.entry))
)

const clockTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// The project picker offers active projects, plus this entry's own project even if it is archived.
const projectChoices = computed(() => {
  const list = [...time.activeProjects]
  const own = time.projectById.get(form.value.projectId)
  if (own && own.archived) list.push(own)
  return list
})

function startEditing() {
  form.value = {
    description: props.entry.description,
    projectId: props.entry.project_id ?? '',
    taskId: props.entry.task_id ?? '',
    startedAt: isoToLocalInput(props.entry.started_at),
    endedAt: isoToLocalInput(props.entry.ended_at)
  }
  editing.value = true
}

async function save() {
  const f = form.value
  const startedAt = localInputToIso(f.startedAt)
  const endedAt = isRunning.value ? null : localInputToIso(f.endedAt)
  if (!startedAt || (!isRunning.value && !endedAt)) return toast.error('Set both a start and an end time.')
  if (endedAt && new Date(endedAt) <= new Date(startedAt)) return toast.error('The end must be after the start.')

  try {
    await time.updateEntry(props.entry.id, {
      description: f.description.trim(),
      project_id: f.projectId || null,
      task_id: f.taskId || null,
      started_at: startedAt,
      ...(isRunning.value ? {} : { ended_at: endedAt })
    })
    editing.value = false
    toast.success('Entry saved')
  } catch (e) {
    toast.error(`Could not save the entry: ${e.message}`)
  }
}

// "Continue": start a new timer with the same description, project and task.
async function continueEntry() {
  try {
    await time.start({
      description: props.entry.description,
      projectId: props.entry.project_id,
      taskId: props.entry.task_id
    })
  } catch (e) {
    toast.error(e.message)
  }
}
</script>

<template>
  <li class="px-4 py-3" :class="{ 'bg-primary/5': isRunning }">
    <!-- Editing -->
    <form v-if="editing" class="space-y-3" @submit.prevent="save">
      <input v-model="form.description" maxlength="200" placeholder="Description" class="input w-full" />
      <div class="grid gap-3 sm:grid-cols-2">
        <select v-model="form.projectId" class="select w-full" aria-label="Project" @change="form.taskId = ''">
          <option value="">No project</option>
          <option v-for="p in projectChoices" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="form.taskId" class="select w-full" aria-label="Task" :disabled="!form.projectId">
          <option value="">No task</option>
          <option v-for="t in time.tasksOf(form.projectId)" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <label class="text-xs">
          <span class="text-base-content/60 mb-1 block">Start</span>
          <input v-model="form.startedAt" type="datetime-local" class="input w-full" />
        </label>
        <label v-if="!isRunning" class="text-xs">
          <span class="text-base-content/60 mb-1 block">End</span>
          <input v-model="form.endedAt" type="datetime-local" class="input w-full" />
        </label>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-ghost btn-sm" @click="editing = false">Cancel</button>
      </div>
    </form>

    <!-- Normal view -->
    <div v-else class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium" :class="{ 'text-base-content/50 italic': !entry.description }">
          {{ entry.description || '(no description)' }}
        </p>
        <p class="text-base-content/60 flex flex-wrap items-center gap-x-2 text-xs">
          <span v-if="project" class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: project.color }"></span>
            {{ project.name }}
          </span>
          <span v-if="task">· {{ task.name }}</span>
          <span>· {{ clockTime(entry.started_at) }} – {{ isRunning ? 'now' : clockTime(entry.ended_at) }}</span>
        </p>
      </div>

      <span class="font-semibold whitespace-nowrap tabular-nums" :class="{ 'text-primary': isRunning }">
        {{ duration }}
      </span>

      <div class="flex shrink-0">
        <button
          v-if="!isRunning"
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Continue this entry"
          @click="continueEntry"
        >
          <Play class="size-4" />
        </button>
        <button class="btn btn-ghost btn-square btn-sm" aria-label="Edit entry" @click="startEditing">
          <Pencil class="size-4" />
        </button>
        <button
          class="btn btn-ghost btn-square btn-sm text-error"
          aria-label="Delete entry"
          @click="time.removeEntryWithUndo(entry)"
        >
          <Trash2 class="size-4" />
        </button>
      </div>
    </div>
  </li>
</template>
