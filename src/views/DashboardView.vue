<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { AlarmClock, CalendarClock, Check, ChevronRight, Flame, Inbox, ListTodo, Trophy } from 'lucide-vue-next'
import { formatMinutes } from '@/lib/stats'
import { countViews } from '@/lib/taskViews'
import { iconLook } from '@/lib/categories'
import { useStatsStore } from '@/stores/stats'
import { useCategoriesStore } from '@/stores/categories'
import { useTasksStore } from '@/stores/tasks'
import StatTile from '@/components/StatTile.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const stats = useStatsStore()
const categories = useCategoriesStore()
const tasks = useTasksStore()

// Numbers for the smart-list tiles, using the same rules as the filtered list they open.
const counts = computed(() => countViews(tasks.tasks))
const todayNumber = new Date().getDate()

// Open tasks per category, for the "My categories" list.
const openByCategory = computed(() => {
  const map = new Map()
  for (const t of tasks.tasks) if (t.status !== 'done') map.set(t.category, (map.get(t.category) ?? 0) + 1)
  return map
})

// Chart.js draws on a <canvas>, which can't use Tailwind classes. So we read the active
// daisyUI theme's colors from CSS variables and re-read them whenever the theme changes.
const inkColor = ref('')
const barColor = ref('')

function readThemeColors() {
  const css = getComputedStyle(document.documentElement)
  barColor.value = css.getPropertyValue('--color-primary').trim()
  inkColor.value = css.getPropertyValue('--color-base-content').trim()
}

let themeObserver
onMounted(() => {
  stats.fetchStats()
  tasks.fetchTasks()
  readThemeColors()
  themeObserver = new MutationObserver(readThemeColors)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
onBeforeUnmount(() => themeObserver?.disconnect())

const weekdayFormat = new Intl.DateTimeFormat([], { weekday: 'short' })

const chartData = computed(() => ({
  labels: stats.last7Days.map((d) => weekdayFormat.format(d.date)),
  datasets: [
    {
      data: stats.last7Days.map((d) => Math.round((d.minutes / 60) * 100) / 100), // hours
      backgroundColor: barColor.value,
      borderRadius: 4,
      borderSkipped: 'bottom', // round the top of each bar, keep the bottom flat
      maxBarThickness: 36
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { display: false }, ticks: { color: inkColor.value } },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Hours', color: inkColor.value },
      grid: { color: `color-mix(in oklab, ${inkColor.value} 12%, transparent)` },
      ticks: { color: inkColor.value, precision: 1 }
    }
  },
  plugins: {
    legend: { display: false }, // one series, and the card title already names it
    tooltip: {
      callbacks: {
        title: (items) => items[0].label,
        label: (item) => formatMinutes(stats.last7Days[item.dataIndex].minutes)
      }
    }
  }
}))

const weekFocusMinutes = computed(() => stats.last7Days.reduce((sum, d) => sum + d.minutes, 0))

const levelHint = computed(
  () =>
    `${stats.level.xpIntoLevel} / ${stats.level.xpForNext} XP to level ${stats.level.level + 1} · ` +
    '10 XP per task, 1 per focus minute'
)
</script>

<template>
  <div class="space-y-6">
    <p v-if="stats.error || tasks.error" class="alert alert-error alert-soft">{{ stats.error || tasks.error }}</p>

    <!-- Smart lists, like Apple Reminders. Each tile opens the matching filtered list. -->
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Your lists">
      <StatTile label="Today" :count="counts.today" tone="blue" :to="{ path: '/', query: { view: 'today' } }">
        <template #icon>
          <span class="grid size-8 place-items-center rounded-lg bg-white/25 text-sm font-bold ring-1 ring-white/50">
            {{ todayNumber }}
          </span>
        </template>
      </StatTile>
      <StatTile
        label="Scheduled"
        :count="counts.scheduled"
        tone="red"
        :to="{ path: '/', query: { view: 'scheduled' } }"
      >
        <template #icon><CalendarClock class="size-8" /></template>
      </StatTile>
      <StatTile label="All" :count="counts.open" tone="graphite" :to="{ path: '/', query: { view: 'open' } }">
        <template #icon><Inbox class="size-8" /></template>
      </StatTile>
      <StatTile label="Overdue" :count="counts.overdue" tone="pink" :to="{ path: '/', query: { view: 'overdue' } }">
        <template #icon><AlarmClock class="size-8" /></template>
      </StatTile>
      <StatTile
        label="Streak"
        :count="stats.streak"
        :hint="stats.streak === 1 ? 'day in a row' : 'days in a row'"
        tone="orange"
      >
        <template #icon><Flame class="size-8" /></template>
      </StatTile>
      <StatTile
        label="Completed"
        :count="stats.weekTotal"
        hint="this week"
        tone="slate"
        :to="{ path: '/', query: { view: 'completed' } }"
      >
        <template #icon><Check class="size-8" /></template>
      </StatTile>
    </section>

    <!-- Level -->
    <StatTile :label="`Level ${stats.level.level}`" :count="`${stats.xp} XP`" :hint="levelHint" tone="violet">
      <template #icon><Trophy class="size-8" /></template>
      <div
        class="mt-2 h-2 overflow-hidden rounded-full bg-white/25"
        role="progressbar"
        :aria-valuenow="stats.level.percent"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progress to the next level"
      >
        <div class="h-full rounded-full bg-white shadow-sm" :style="{ width: `${stats.level.percent}%` }"></div>
      </div>
    </StatTile>

    <!-- My categories, like Apple's "My Lists" -->
    <section class="space-y-2">
      <div class="flex items-baseline justify-between px-1">
        <h2 class="text-xl font-bold">My categories</h2>
        <RouterLink v-if="categories.ready" to="/settings#categories" class="link link-hover text-sm">Edit</RouterLink>
      </div>
      <ul class="card card-border bg-base-100 divide-base-300 divide-y overflow-hidden">
        <li v-for="c in categories.all" :key="c.key">
          <RouterLink
            :to="{ path: '/', query: { category: c.key } }"
            class="hover:bg-base-200 flex items-center gap-3 px-4 py-3"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full shadow-sm"
              :class="iconLook(c.color).class"
              :style="iconLook(c.color).style"
            >
              <ListTodo class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ c.label }}</span>
              <span class="text-base-content/60 block text-xs">
                {{ stats.weekByCategory[c.key] ?? 0 }} done this week
              </span>
            </span>
            <span class="text-base-content/60 tabular-nums" :aria-label="`${openByCategory.get(c.key) ?? 0} open`">
              {{ openByCategory.get(c.key) ?? 0 }}
            </span>
            <ChevronRight class="text-base-content/40 size-5" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="card card-border bg-base-100 p-5 shadow-sm">
      <h2 class="mb-1 font-semibold">Focus hours, last 7 days</h2>
      <p class="text-base-content/60 mb-3 text-sm">{{ formatMinutes(weekFocusMinutes) }} in total</p>
      <div class="h-64">
        <Bar :data="chartData" :options="chartOptions" aria-label="Bar chart of focus hours per day" role="img" />
      </div>

      <!-- Same numbers as the chart, as a table, for screen readers. -->
      <table class="sr-only">
        <caption>Focus time per day, last 7 days</caption>
        <tbody>
          <tr v-for="d in stats.last7Days" :key="d.key">
            <th scope="row">{{ d.key }}</th>
            <td>{{ formatMinutes(d.minutes) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
