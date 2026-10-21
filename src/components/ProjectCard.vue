<script setup>
import { computed, ref } from 'vue'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, X } from 'lucide-vue-next'
import { formatMoney } from '@/lib/time'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'

const props = defineProps({ project: { type: Object, required: true } })

const time = useTimeStore()
const toast = useToastStore()

// Puts the cursor in the rename box as soon as it appears.
const vFocus = { mounted: (el) => el.focus() }

const tasks = computed(() => time.tasksOf(props.project.id))

// ---------- Editing the project itself ----------
const editing = ref(false)
const form = ref({})

function startEditing() {
  form.value = {
    name: props.project.name,
    client: props.project.client ?? '',
    color: props.project.color,
    hourlyRate: props.project.hourly_rate ?? ''
  }
  editing.value = true
}

async function save() {
  try {
    await time.updateProject(props.project.id, {
      name: form.value.name.trim(),
      client: form.value.client.trim() || null,
      color: form.value.color,
      hourly_rate: form.value.hourlyRate === '' ? null : Number(form.value.hourlyRate)
    })
    editing.value = false
    toast.success('Project saved')
  } catch (e) {
    toast.error(`Could not save the project: ${e.message}`)
  }
}

async function toggleArchive() {
  try {
    await time.updateProject(props.project.id, { archived: !props.project.archived })
    toast.success(props.project.archived ? 'Project restored' : 'Project archived. Its hours stay in your reports.')
  } catch (e) {
    toast.error(e.message)
  }
}

// Two clicks to delete, so a stray tap can't remove a project.
const confirmingDelete = ref(false)

async function remove() {
  try {
    await time.deleteProject(props.project.id)
    toast.success('Project deleted')
  } catch (e) {
    confirmingDelete.value = false
    toast.error(e.message) // e.g. "has time entries, archive it instead"
  }
}

// ---------- Tasks inside the project ----------
const newTask = ref('')
const renamingId = ref(null)
const renameValue = ref('')

async function addTask() {
  if (!newTask.value.trim()) return
  try {
    await time.addProjectTask(props.project.id, newTask.value)
    newTask.value = ''
  } catch (e) {
    toast.error(`Could not add the task: ${e.message}`)
  }
}

function startRename(task) {
  renamingId.value = task.id
  renameValue.value = task.name
}

async function saveRename(task) {
  if (renamingId.value !== task.id) return // already handled (Enter pressed, then the box lost focus)
  renamingId.value = null
  const name = renameValue.value.trim()
  if (!name || name === task.name) return
  try {
    await time.renameProjectTask(task.id, name)
  } catch (e) {
    toast.error(`Could not rename the task: ${e.message}`)
  }
}

async function removeTask(task) {
  try {
    await time.deleteProjectTask(task.id)
  } catch (e) {
    toast.error(`Could not delete the task: ${e.message}`)
  }
}
</script>

<template>
  <article class="card card-border bg-base-100 space-y-3 p-4" :class="{ 'opacity-70': project.archived }">
    <!-- Editing -->
    <form v-if="editing" class="space-y-3" @submit.prevent="save">
      <div class="flex gap-2">
        <input
          v-model="form.color"
          type="color"
          class="border-base-300 h-12 w-14 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
          aria-label="Project color"
        />
        <input v-model="form.name" required maxlength="80" placeholder="Project name" class="input w-full" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="form.client" maxlength="80" placeholder="Client (optional)" class="input w-full" />
        <input
          v-model="form.hourlyRate"
          type="number"
          min="0"
          step="0.01"
          placeholder="Hourly rate (optional)"
          class="input w-full"
        />
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-ghost btn-sm" @click="editing = false">Cancel</button>
      </div>
    </form>

    <!-- Header -->
    <header v-else class="flex items-center gap-3">
      <span class="size-4 shrink-0 rounded-full" :style="{ backgroundColor: project.color }"></span>
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-semibold">
          {{ project.name }}
          <span v-if="project.archived" class="badge badge-sm ml-1">Archived</span>
        </h3>
        <p class="text-base-content/60 truncate text-xs">
          {{ project.client || 'No client' }}
          <template v-if="project.hourly_rate !== null">
            · {{ formatMoney(project.hourly_rate, time.currency) }}/h
          </template>
        </p>
      </div>
      <div class="flex shrink-0">
        <button class="btn btn-ghost btn-square btn-sm" aria-label="Edit project" @click="startEditing">
          <Pencil class="size-4" />
        </button>
        <button
          class="btn btn-ghost btn-square btn-sm"
          :aria-label="project.archived ? 'Restore project' : 'Archive project'"
          @click="toggleArchive"
        >
          <ArchiveRestore v-if="project.archived" class="size-4" />
          <Archive v-else class="size-4" />
        </button>
        <button
          v-if="!confirmingDelete"
          class="btn btn-ghost btn-square btn-sm text-error"
          aria-label="Delete project"
          @click="confirmingDelete = true"
        >
          <Trash2 class="size-4" />
        </button>
        <template v-else>
          <button class="btn btn-error btn-sm" @click="remove">Delete?</button>
          <button class="btn btn-ghost btn-square btn-sm" aria-label="Cancel delete" @click="confirmingDelete = false">
            <X class="size-4" />
          </button>
        </template>
      </div>
    </header>

    <!-- Tasks -->
    <div class="space-y-2">
      <p class="text-base-content/60 text-xs font-medium tracking-wide uppercase">Tasks</p>
      <ul v-if="tasks.length" class="space-y-1">
        <li v-for="task in tasks" :key="task.id" class="bg-base-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
          <input
            v-if="renamingId === task.id"
            v-model="renameValue"
            maxlength="80"
            v-focus
            class="input input-sm w-full"
            @keydown.enter.prevent="saveRename(task)"
            @keydown.esc="renamingId = null"
            @blur="saveRename(task)"
          />
          <template v-else>
            <span class="min-w-0 flex-1 truncate">{{ task.name }}</span>
            <button class="btn btn-ghost btn-square btn-xs" aria-label="Rename task" @click="startRename(task)">
              <Pencil class="size-3.5" />
            </button>
            <button class="btn btn-ghost btn-square btn-xs text-error" aria-label="Delete task" @click="removeTask(task)">
              <X class="size-3.5" />
            </button>
          </template>
        </li>
      </ul>
      <p v-else class="text-base-content/50 text-sm">No tasks yet. Tracking time straight to the project works too.</p>

      <form class="flex gap-2" @submit.prevent="addTask">
        <input v-model="newTask" maxlength="80" placeholder="Add a task" class="input input-sm w-full" />
        <button class="btn btn-sm btn-primary btn-square" aria-label="Add task"><Plus class="size-4" /></button>
      </form>
    </div>
  </article>
</template>
