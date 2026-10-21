<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { callCoach } from '@/lib/coach'
import { useStatsStore } from '@/stores/stats'
import { useTasksStore } from '@/stores/tasks'
import { categoryList } from '@/lib/categories'

const tasks = useTasksStore()
const stats = useStatsStore()

onMounted(() => {
  tasks.fetchTasks()
  stats.fetchStats()
})

// ---------- 1. Break a goal into tasks ----------
const goal = ref('')
const suggestions = ref([]) // each one: { title, notes, category, selected }
const breakdownState = reactive({ loading: false, error: '', added: 0 })

async function breakDownGoal() {
  Object.assign(breakdownState, { loading: true, error: '', added: 0 })
  suggestions.value = []
  try {
    const { tasks: list } = await callCoach('breakdown', { goal: goal.value })
    suggestions.value = list.map((t) => ({ ...t, selected: true }))
  } catch (e) {
    breakdownState.error = e.message
  } finally {
    breakdownState.loading = false
  }
}

const selectedCount = computed(() => suggestions.value.filter((s) => s.selected).length)

async function addSelected() {
  breakdownState.error = ''
  try {
    const chosen = suggestions.value.filter((s) => s.selected)
    await tasks.addTasks(chosen)
    breakdownState.added = chosen.length
    suggestions.value = []
    goal.value = ''
  } catch (e) {
    breakdownState.error = e.message
  }
}

// ---------- 2. Daily plan ----------
const plan = ref(null) // { intro, steps: [{ task, reason }] }
const planState = reactive({ loading: false, error: '' })

const openTasks = computed(() => tasks.tasks.filter((t) => t.status !== 'done'))
const overdueTasks = computed(() =>
  openTasks.value.filter((t) => t.due_at && new Date(t.due_at) < new Date())
)

async function planMyDay() {
  Object.assign(planState, { loading: true, error: '' })
  try {
    const { intro, steps } = await callCoach('plan', {
      now: new Date().toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }),
      tasks: openTasks.value.slice(0, 40).map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        status: t.status,
        due_at: t.due_at,
        overdue: overdueTasks.value.includes(t)
      }))
    })
    // The function sends back task ids; we look up the real tasks here.
    const byId = new Map(tasks.tasks.map((t) => [t.id, t]))
    plan.value = {
      intro,
      steps: steps.filter((s) => byId.has(s.task_id)).map((s) => ({ task: byId.get(s.task_id), reason: s.reason }))
    }
  } catch (e) {
    planState.error = e.message
  } finally {
    planState.loading = false
  }
}

// ---------- 3. Check-in ----------
const checkinMessage = ref('')
const checkinState = reactive({ loading: false, error: '' })

async function getCheckin() {
  Object.assign(checkinState, { loading: true, error: '' })
  try {
    const last7 = stats.last7Days
    const { message } = await callCoach('checkin', {
      stats: {
        streak: stats.streak,
        completedThisWeek: stats.weekByCategory,
        openTasks: openTasks.value.length,
        overdueTasks: overdueTasks.value.length,
        focusMinutesToday: last7[last7.length - 1].minutes,
        focusMinutesWeek: last7.reduce((sum, d) => sum + d.minutes, 0)
      }
    })
    checkinMessage.value = message
  } catch (e) {
    checkinState.error = e.message
  } finally {
    checkinState.loading = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- 1. Break a goal into tasks -->
    <section class="card card-border bg-base-100 space-y-3 p-5 shadow-sm">
      <h2 class="font-semibold">Break a goal into tasks</h2>
      <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="breakDownGoal">
        <input
          v-model="goal"
          required
          maxlength="500"
          placeholder="e.g. Get my first junior Vue developer interview"
          class="input w-full"
        />
        <button class="btn btn-primary" :disabled="breakdownState.loading">
          <span v-if="breakdownState.loading" class="loading loading-spinner loading-sm"></span>
          Suggest tasks
        </button>
      </form>

      <p v-if="breakdownState.error" class="text-error text-sm">{{ breakdownState.error }}</p>
      <p v-if="breakdownState.added" class="text-success text-sm">
        Added {{ breakdownState.added }} tasks to your list.
      </p>

      <template v-if="suggestions.length">
        <ul class="space-y-2">
          <li
            v-for="(s, i) in suggestions"
            :key="i"
            class="border-base-300 flex items-start gap-3 rounded-lg border p-3"
          >
            <input v-model="s.selected" type="checkbox" class="checkbox checkbox-primary mt-1" />
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ s.title }}</p>
              <p class="text-base-content/70 text-sm">{{ s.notes }}</p>
            </div>
            <select v-model="s.category" class="select select-sm w-auto" aria-label="Category">
              <option v-for="c in categoryList" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </li>
        </ul>
        <button class="btn btn-primary" :disabled="!selectedCount" @click="addSelected">
          Add {{ selectedCount }} selected to my tasks
        </button>
      </template>
    </section>

    <!-- 2. Daily plan -->
    <section class="card card-border bg-base-100 space-y-3 p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">Plan my day</h2>
        <button class="btn btn-primary btn-sm" :disabled="planState.loading" @click="planMyDay">
          <span v-if="planState.loading" class="loading loading-spinner loading-sm"></span>
          {{ plan ? 'Refresh plan' : 'Suggest a plan' }}
        </button>
      </div>
      <p v-if="planState.error" class="text-error text-sm">{{ planState.error }}</p>
      <template v-if="plan">
        <p>{{ plan.intro }}</p>
        <ol class="space-y-2">
          <li
            v-for="(step, i) in plan.steps"
            :key="step.task.id"
            class="border-base-300 flex gap-3 rounded-lg border p-3"
          >
            <span class="badge badge-primary">{{ i + 1 }}</span>
            <div>
              <p class="font-medium">{{ step.task.title }}</p>
              <p class="text-base-content/70 text-sm">{{ step.reason }}</p>
            </div>
          </li>
        </ol>
      </template>
    </section>

    <!-- 3. Check-in -->
    <section class="card card-border bg-base-100 space-y-3 p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">Check-in</h2>
        <button
          class="btn btn-primary btn-sm"
          :disabled="checkinState.loading || stats.loading"
          @click="getCheckin"
        >
          <span v-if="checkinState.loading" class="loading loading-spinner loading-sm"></span>
          How am I doing?
        </button>
      </div>
      <p v-if="checkinState.error" class="text-error text-sm">{{ checkinState.error }}</p>
      <p v-if="checkinMessage" class="bg-base-200 rounded-lg p-3">{{ checkinMessage }}</p>
      <p class="text-base-content/60 text-xs">
        Based on your real streak, completed and overdue tasks, and focus time.
      </p>
    </section>
  </div>
</template>
