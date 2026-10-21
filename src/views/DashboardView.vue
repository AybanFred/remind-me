<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { useStatsStore } from '@/stores/stats'
import { formatMinutes } from '@/lib/stats'
import { Flame, Trophy } from 'lucide-vue-next'
import { useCategoriesStore } from '@/stores/categories'
import CategoryBadge from '@/components/CategoryBadge.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const stats = useStatsStore()
const categories = useCategoriesStore()

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
</script>

<template>
  <div class="space-y-6">

    <p v-if="stats.error" class="text-error">{{ stats.error }}</p>
    <span v-if="stats.loading" class="loading loading-spinner"></span>

    <section class="card card-border bg-base-100 p-5">
      <div class="flex items-center gap-4">
        <div class="bg-primary text-primary-content flex size-14 shrink-0 flex-col items-center justify-center rounded-full">
          <Trophy class="size-4" />
          <span class="text-lg leading-none font-bold tabular-nums">{{ stats.level.level }}</span>
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="font-semibold">Level {{ stats.level.level }}</h2>
            <span class="text-base-content/60 text-sm tabular-nums">
              {{ stats.level.xpIntoLevel }} / {{ stats.level.xpForNext }} XP
            </span>
          </div>
          <progress class="progress progress-primary w-full" :value="stats.level.percent" max="100"></progress>
          <p class="text-base-content/60 text-xs">
            {{ stats.xp }} XP in total. Earn 10 XP per finished task and 1 XP per focus minute.
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2">
      <div class="card card-border bg-base-100 p-5 shadow-sm">
        <h2 class="text-base-content/60 flex items-center gap-1.5 text-sm">
          <Flame class="text-accent size-4" /> Current streak
        </h2>
        <p class="text-accent text-5xl font-bold tabular-nums">
          {{ stats.streak }}
          <span class="text-base-content/60 text-lg font-normal">{{ stats.streak === 1 ? 'day' : 'days' }}</span>
        </p>
        <p class="text-base-content/60 text-sm">
          Days in a row with a completed task or a focus session.
        </p>
      </div>

      <div class="card card-border bg-base-100 p-5 shadow-sm">
        <h2 class="text-base-content/60 text-sm">Tasks completed this week</h2>
        <p class="text-5xl font-bold tabular-nums">{{ stats.weekTotal }}</p>
        <ul class="mt-2 space-y-1 text-sm">
          <li v-for="c in categories.all" :key="c.key" class="flex items-center justify-between">
            <CategoryBadge :category="c.key" small />
            <span class="font-medium tabular-nums">{{ stats.weekByCategory[c.key] ?? 0 }}</span>
          </li>
        </ul>
      </div>
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
