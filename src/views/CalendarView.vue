<script setup>
import { computed, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { monthGrid, tasksByDueDay } from '@/lib/calendar'
import { dotLook } from '@/lib/categories'
import { dateKey } from '@/lib/stats'
import { useCategoriesStore } from '@/stores/categories'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import CategoryBadge from '@/components/CategoryBadge.vue'
import TaskModal from '@/components/TaskModal.vue'
import TaskViewTabs from '@/components/TaskViewTabs.vue'

const tasks = useTasksStore()
const categories = useCategoriesStore()
const toast = useToastStore()

onMounted(() => tasks.fetchTasks())

// ---------- Which month is showing ----------
const today = new Date()
const todayKey = dateKey(today)
const year = ref(today.getFullYear())
const month = ref(today.getMonth()) // 0-11

function changeMonth(step) {
  const d = new Date(year.value, month.value + step, 1)
  year.value = d.getFullYear()
  month.value = d.getMonth()
}
function goToToday() {
  year.value = today.getFullYear()
  month.value = today.getMonth()
  selectedKey.value = todayKey
}

const monthTitle = computed(() =>
  new Date(year.value, month.value, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
)

// Mon, Tue, ... in the user's language (26 Oct 2026 is a Monday).
const weekdays = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 9, 26 + i).toLocaleDateString([], { weekday: 'short' })
)

const days = computed(() => monthGrid(year.value, month.value))
const byDay = computed(() => tasksByDueDay(tasks.tasks))
const undatedCount = computed(() => tasks.tasks.filter((t) => !t.due_at && t.status !== 'done').length)

// ---------- The selected day ----------
const selectedKey = ref(todayKey)
const selectedTasks = computed(() => byDay.value.get(selectedKey.value) ?? [])
const selectedTitle = computed(() => {
  const [y, m, d] = selectedKey.value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
})

function selectDay(day) {
  selectedKey.value = day.key
  // Clicking a grey day from the next or previous month jumps to that month.
  if (!day.inMonth) {
    year.value = day.date.getFullYear()
    month.value = day.date.getMonth()
  }
}

const isOverdue = (task) => task.status !== 'done' && new Date(task.due_at) < new Date()
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const colorOf = (task) => categories.byKey.get(task.category)?.color ?? 'neutral'

// ---------- Quick add on the selected day ----------
const newTitle = ref('')
const newCategory = ref(categories.all[0]?.key ?? 'daily')
const newTime = ref('09:00')

async function quickAdd() {
  if (!newTitle.value.trim()) return
  const due = new Date(`${selectedKey.value}T${newTime.value || '09:00'}`)
  try {
    await tasks.addTask({
      title: newTitle.value.trim(),
      notes: '',
      category: newCategory.value,
      due_at: due.toISOString()
    })
    newTitle.value = ''
    toast.success('Task added')
  } catch (e) {
    toast.error(`Could not add the task: ${e.message}`)
  }
}

const openTaskId = ref(null)
</script>

<template>
  <div class="space-y-4">
    <TaskViewTabs />

    <section class="card card-border bg-base-100 p-3 sm:p-4">
      <!-- Month header -->
      <header class="mb-3 flex items-center gap-2">
        <h2 class="flex-1 text-lg font-bold capitalize">{{ monthTitle }}</h2>
        <button class="btn btn-ghost btn-sm" @click="goToToday">Today</button>
        <button class="btn btn-ghost btn-sm btn-square" aria-label="Previous month" @click="changeMonth(-1)">
          <ChevronLeft class="size-5" />
        </button>
        <button class="btn btn-ghost btn-sm btn-square" aria-label="Next month" @click="changeMonth(1)">
          <ChevronRight class="size-5" />
        </button>
      </header>

      <!-- Weekday names -->
      <div class="text-base-content/60 grid grid-cols-7 pb-1 text-center text-xs font-medium">
        <span v-for="w in weekdays" :key="w">{{ w }}</span>
      </div>

      <!-- Days -->
      <div class="bg-base-300 rounded-box grid grid-cols-7 gap-px overflow-hidden">
        <button
          v-for="day in days"
          :key="day.key"
          class="bg-base-100 hover:bg-base-200 flex min-h-14 flex-col items-stretch gap-1 p-1 text-left sm:min-h-24 sm:p-1.5"
          :class="{
            'text-base-content/40': !day.inMonth,
            'ring-primary relative z-10 ring-2 ring-inset': day.key === selectedKey
          }"
          :aria-label="`${day.date.toDateString()}, ${(byDay.get(day.key) ?? []).length} tasks`"
          @click="selectDay(day)"
        >
          <span
            class="grid size-6 place-items-center self-center rounded-full text-xs font-semibold sm:self-start"
            :class="{ 'bg-primary text-primary-content': day.key === todayKey }"
          >
            {{ day.date.getDate() }}
          </span>

          <!-- Phones: coloured dots. Larger screens: task titles. -->
          <span v-if="byDay.get(day.key)" class="flex flex-wrap justify-center gap-0.5 sm:hidden">
            <span
              v-for="t in byDay.get(day.key).slice(0, 4)"
              :key="t.id"
              class="size-1.5 rounded-full"
              :class="[dotLook(colorOf(t)).class, { 'opacity-40': t.status === 'done' }]"
              :style="dotLook(colorOf(t)).style"
            ></span>
          </span>
          <span v-if="byDay.get(day.key)" class="hidden space-y-0.5 sm:block">
            <span
              v-for="t in byDay.get(day.key).slice(0, 3)"
              :key="t.id"
              class="flex items-center gap-1 truncate text-[0.7rem] leading-tight"
              :class="{ 'line-through opacity-50': t.status === 'done', 'text-error': isOverdue(t) }"
            >
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="dotLook(colorOf(t)).class"
                :style="dotLook(colorOf(t)).style"
              ></span>
              <span class="truncate">{{ t.title }}</span>
            </span>
            <span v-if="byDay.get(day.key).length > 3" class="text-base-content/50 block text-[0.7rem]">
              +{{ byDay.get(day.key).length - 3 }} more
            </span>
          </span>
        </button>
      </div>
    </section>

    <!-- The selected day -->
    <section class="card card-border bg-base-100 space-y-3 p-4">
      <h2 class="font-semibold">{{ selectedTitle }}</h2>

      <ul v-if="selectedTasks.length" class="space-y-2">
        <li v-for="t in selectedTasks" :key="t.id">
          <button
            class="bg-base-200 hover:bg-base-300 flex w-full items-center gap-3 rounded-lg p-3 text-left"
            @click="openTaskId = t.id"
          >
            <span class="w-16 shrink-0 text-xs tabular-nums" :class="isOverdue(t) ? 'text-error font-semibold' : 'text-base-content/60'">
              {{ timeOf(t.due_at) }}
            </span>
            <span class="min-w-0 flex-1 truncate font-medium" :class="{ 'line-through opacity-50': t.status === 'done' }">
              {{ t.title }}
            </span>
            <CategoryBadge :category="t.category" small />
          </button>
        </li>
      </ul>
      <p v-else class="text-base-content/60 text-sm">Nothing due on this day.</p>

      <form class="flex flex-wrap gap-2" @submit.prevent="quickAdd">
        <input v-model="newTitle" placeholder="Add a task for this day" maxlength="200" class="input input-sm min-w-40 flex-1" />
        <input v-model="newTime" type="time" class="input input-sm w-28" aria-label="Time" />
        <select v-model="newCategory" class="select select-sm w-auto" aria-label="Category">
          <option v-for="c in categories.all" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="!newTitle.trim()"><Plus class="size-4" /> Add</button>
      </form>

      <p v-if="undatedCount" class="text-base-content/50 text-xs">
        {{ undatedCount }} open {{ undatedCount === 1 ? 'task has' : 'tasks have' }} no due date, so
        {{ undatedCount === 1 ? "it isn't" : "they aren't" }} on the calendar.
        <RouterLink to="/" class="link">See the list</RouterLink>
      </p>
    </section>

    <TaskModal v-if="openTaskId" :task-id="openTaskId" @close="openTaskId = null" />
  </div>
</template>
