<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { useStatsStore } from '@/stores/stats'
import { formatMinutes } from '@/lib/stats'
import AppHeader from '@/components/AppHeader.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const stats = useStatsStore()

const categories = [
  { key: 'upskilling', label: 'Upskilling' },
  { key: 'job_hunt', label: 'Job hunt' },
  { key: 'daily', label: 'Daily' }
]

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
  <div class="mx-auto max-w-3xl space-y-6 p-4">
    <AppHeader />

    <p v-if="stats.error" class="text-error">{{ stats.error }}</p>
    <span v-if="stats.loading" class="loading loading-spinner"></span>

    <section class="grid gap-4 sm:grid-cols-2">
      <div class="card card-border bg-base-100 p-5 shadow-sm">
        <h2 class="text-base-content/60 text-sm">Current streak</h2>
        <p class="text-primary text-5xl font-bold tabular-nums">
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
          <li v-for="c in categories" :key="c.key" class="flex justify-between">
            <span>{{ c.label }}</span>
            <span class="font-medium tabular-nums">{{ stats.weekByCategory[c.key] }}</span>
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
