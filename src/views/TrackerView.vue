<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ClockPlus, Play, Square } from 'lucide-vue-next'
import { localInputToIso, isoToLocalInput } from '@/lib/dates'
import { durationSeconds, formatHours, rangeFor } from '@/lib/time'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'
import TimeEntryRow from '@/components/TimeEntryRow.vue'

const time = useTimeStore()
const toast = useToastStore()

onMounted(() => time.fetchAll())

// ---------- The timer form ----------
const description = ref('')
const projectId = ref('')
const taskId = ref('')

const running = computed(() => time.running)

// When a timer is running (also one started on another device), the form shows its details.
watch(
  () => running.value?.id,
  (id, previousId) => {
    if (id) {
      description.value = running.value.description
      projectId.value = running.value.project_id ?? ''
      taskId.value = running.value.task_id ?? ''
    } else if (previousId) {
      description.value = '' // the project stays selected, ready for the next entry
      taskId.value = ''
    }
  },
  { immediate: true }
)

const projectChoices = computed(() => {
  const list = [...time.activeProjects]
  const current = time.projectById.get(projectId.value)
  if (current?.archived) list.push(current)
  return list
})
const selectedProject = computed(() => time.projectById.get(projectId.value))

// While a timer runs, editing the form edits that timer (like Clockify).
async function saveRunning() {
  if (!running.value) return
  try {
    await time.updateEntry(running.value.id, {
      description: description.value.trim(),
      project_id: projectId.value || null,
      task_id: taskId.value || null
    })
  } catch (e) {
    toast.error(`Could not update the timer: ${e.message}`)
  }
}

function onProjectChange() {
  taskId.value = '' // tasks belong to one project, so the old choice no longer applies
  saveRunning()
}

async function startOrUpdate() {
  if (running.value) return saveRunning()
  try {
    await time.start({
      description: description.value,
      projectId: projectId.value || null,
      taskId: taskId.value || null
    })
  } catch (e) {
    toast.error(e.message)
  }
}

async function stop() {
  const seconds = durationSeconds(running.value, Date.now())
  try {
    await time.stop()
    toast.success(`Logged ${formatHours(seconds)}`)
  } catch (e) {
    toast.error(`Could not stop the timer: ${e.message}`)
  }
}

// ---------- Totals ----------
const todaySeconds = computed(() => totalFor(rangeFor('today')))
const weekSeconds = computed(() => totalFor(rangeFor('week')))

function totalFor({ from, to }) {
  return time.entries
    .filter((e) => new Date(e.started_at) >= from && new Date(e.started_at) < to)
    .reduce((sum, e) => sum + durationSeconds(e, time.now), 0)
}

// ---------- Adding time by hand (for when you forgot to start the timer) ----------
const manual = ref({ description: '', projectId: '', taskId: '', startedAt: '', endedAt: '' })

function resetManualTimes() {
  const end = new Date()
  end.setSeconds(0, 0)
  const start = new Date(end.getTime() - 3600000)
  manual.value.startedAt = isoToLocalInput(start.toISOString())
  manual.value.endedAt = isoToLocalInput(end.toISOString())
}
resetManualTimes()

async function addManual() {
  const m = manual.value
  const startedAt = localInputToIso(m.startedAt)
  const endedAt = localInputToIso(m.endedAt)
  if (!startedAt || !endedAt || new Date(endedAt) <= new Date(startedAt)) {
    return toast.error('The end must be after the start.')
  }
  try {
    await time.addManualEntry({
      description: m.description,
      projectId: m.projectId || null,
      taskId: m.taskId || null,
      startedAt,
      endedAt
    })
    toast.success('Time added')
    manual.value.description = ''
    resetManualTimes()
  } catch (e) {
    toast.error(`Could not add the time: ${e.message}`)
  }
}

// If the tables don't exist yet, say what to do instead of showing a raw database error.
const setupNeeded = computed(() => /time_entries|projects|project_tasks|schema cache/i.test(time.error))
</script>

<template>
  <div class="space-y-5">
    <div v-if="setupNeeded" class="alert alert-warning alert-soft" role="alert">
      <span>
        The time tracking tables are not set up yet. Run
        <code>supabase/migrations/20261023000000_time_tracking.sql</code> in the Supabase SQL Editor, then refresh.
      </span>
    </div>
    <p v-else-if="time.error" class="alert alert-error alert-soft">{{ time.error }}</p>

    <!-- The timer -->
    <form class="card card-border bg-base-100 space-y-3 p-4" @submit.prevent="startOrUpdate">
      <input
        v-model="description"
        maxlength="200"
        placeholder="What are you working on?"
        class="input input-lg w-full"
        @blur="saveRunning"
      />

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex items-center gap-2">
          <span
            class="size-3 shrink-0 rounded-full"
            :style="{ backgroundColor: selectedProject?.color ?? 'transparent' }"
            :class="{ 'border-base-300 border': !selectedProject }"
          ></span>
          <select v-model="projectId" class="select w-full" aria-label="Project" @change="onProjectChange">
            <option value="">No project</option>
            <option v-for="p in projectChoices" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <select
          v-model="taskId"
          class="select w-full"
          aria-label="Task"
          :disabled="!projectId"
          @change="saveRunning"
        >
          <option value="">{{ projectId ? 'No task' : 'Pick a project to choose a task' }}</option>
          <option v-for="t in time.tasksOf(projectId)" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>

      <div class="flex items-center justify-between gap-4">
        <p
          class="text-4xl font-bold tabular-nums"
          :class="running ? 'text-primary' : 'text-base-content/40'"
          role="timer"
        >
          {{ running ? time.clock : '0:00:00' }}
        </p>
        <button v-if="!running" type="submit" class="btn btn-primary btn-lg px-8">
          <Play class="size-5" /> Start
        </button>
        <button v-else type="button" class="btn btn-error btn-lg px-8" @click="stop">
          <Square class="size-5" /> Stop
        </button>
      </div>

      <p v-if="!time.projects.length" class="text-base-content/60 text-sm">
        Tip: create a project first under the
        <RouterLink to="/time/projects" class="link">Projects</RouterLink> tab, so you can sort your hours.
      </p>
    </form>

    <!-- Totals -->
    <div class="flex flex-wrap gap-3 text-sm">
      <span class="badge badge-lg badge-soft">Today: <strong class="ml-1">{{ formatHours(todaySeconds) }}</strong></span>
      <span class="badge badge-lg badge-soft">This week: <strong class="ml-1">{{ formatHours(weekSeconds) }}</strong></span>
    </div>

    <!-- Add time manually -->
    <div class="collapse-arrow border-base-300 bg-base-100 collapse border">
      <input type="checkbox" aria-label="Show the manual entry form" />
      <div class="collapse-title flex items-center gap-2 font-medium">
        <ClockPlus class="size-4" /> Add time manually
      </div>
      <div class="collapse-content">
        <form class="space-y-3 pt-1" @submit.prevent="addManual">
          <input v-model="manual.description" maxlength="200" placeholder="Description" class="input w-full" />
          <div class="grid gap-3 sm:grid-cols-2">
            <select v-model="manual.projectId" class="select w-full" aria-label="Project" @change="manual.taskId = ''">
              <option value="">No project</option>
              <option v-for="p in time.activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <select v-model="manual.taskId" class="select w-full" aria-label="Task" :disabled="!manual.projectId">
              <option value="">No task</option>
              <option v-for="t in time.tasksOf(manual.projectId)" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <label class="text-xs">
              <span class="text-base-content/60 mb-1 block">Start</span>
              <input v-model="manual.startedAt" type="datetime-local" required class="input w-full" />
            </label>
            <label class="text-xs">
              <span class="text-base-content/60 mb-1 block">End</span>
              <input v-model="manual.endedAt" type="datetime-local" required class="input w-full" />
            </label>
          </div>
          <button class="btn btn-primary btn-sm">Add entry</button>
        </form>
      </div>
    </div>

    <!-- Entries by day -->
    <div v-if="time.loading && !time.entries.length" class="space-y-3">
      <div v-for="n in 3" :key="n" class="skeleton h-16 w-full"></div>
    </div>

    <p v-else-if="!time.days.length && !time.error" class="text-base-content/60 py-8 text-center text-sm">
      No time logged in the last 30 days. Press Start to track your first entry.
    </p>

    <section v-for="day in time.days" :key="day.key" class="card card-border bg-base-100 overflow-hidden">
      <header class="bg-base-200 flex items-center justify-between px-4 py-2 text-sm">
        <h2 class="font-semibold">{{ day.label }}</h2>
        <span class="font-semibold tabular-nums">{{ formatHours(day.seconds) }}</span>
      </header>
      <ul class="divide-base-300 divide-y">
        <TimeEntryRow v-for="entry in day.entries" :key="entry.id" :entry="entry" />
      </ul>
    </section>
  </div>
</template>
