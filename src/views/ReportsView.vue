<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { dateKey } from '@/lib/stats'
import {
  buildCsv,
  decimalHours,
  durationSeconds,
  formatHours,
  formatMoney,
  rangeFor,
  summarizeByProject
} from '@/lib/time'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'

const time = useTimeStore()
const toast = useToastStore()

const presets = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom range' }
]

const preset = ref('week')
const projectFilter = ref('') // '' = all projects, 'none' = entries without a project, or a project id
const customFrom = ref(dateKey(new Date(Date.now() - 6 * 86400000)))
const customTo = ref(dateKey(new Date()))

const entries = ref([])
const loading = ref(false)

// The range as real dates. For a custom range, the end day is included in full.
const range = computed(() => {
  if (preset.value !== 'custom') return rangeFor(preset.value)
  const from = new Date(`${customFrom.value}T00:00:00`)
  const to = new Date(`${customTo.value}T00:00:00`)
  to.setDate(to.getDate() + 1)
  return { from, to }
})

async function load() {
  const { from, to } = range.value
  if (!(from < to)) {
    entries.value = []
    return
  }
  loading.value = true
  try {
    await time.fetchAll() // so project and task names are up to date
    entries.value = await time.fetchRange(from, to)
  } catch (e) {
    toast.error(`Could not load the report: ${e.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([preset, customFrom, customTo], load)

const filtered = computed(() => {
  if (!projectFilter.value) return entries.value
  if (projectFilter.value === 'none') return entries.value.filter((e) => !e.project_id)
  return entries.value.filter((e) => e.project_id === projectFilter.value)
})

const now = computed(() => time.now) // a running entry keeps counting while the page is open
const summary = computed(() => summarizeByProject(filtered.value, time.projects, now.value))
const totalSeconds = computed(() => summary.value.reduce((sum, g) => sum + g.seconds, 0))
const totalAmount = computed(() => summary.value.reduce((sum, g) => sum + (g.amount ?? 0), 0))
const hasRates = computed(() => summary.value.some((g) => g.amount !== null))

// Hours for each day in the range, for the little bar chart.
const perDay = computed(() => {
  const { from, to } = range.value
  const days = []
  for (let d = new Date(from); d < to && days.length < 62; d.setDate(d.getDate() + 1)) {
    days.push({ key: dateKey(d), date: new Date(d), seconds: 0 })
  }
  const byKey = new Map(days.map((d) => [d.key, d]))
  for (const entry of filtered.value) {
    const day = byKey.get(dateKey(new Date(entry.started_at)))
    if (day) day.seconds += durationSeconds(entry, now.value)
  }
  return days
})
const busiestDay = computed(() => Math.max(1, ...perDay.value.map((d) => d.seconds)))

const taskName = (id) => time.taskById.get(id)?.name ?? 'No task'
const dayLabel = (d) => d.date.toLocaleDateString([], { weekday: 'short', day: 'numeric' })

function exportCsv() {
  const csv = buildCsv(filtered.value, { projectById: time.projectById, taskById: time.taskById })
  // The leading ﻿ makes Excel read the file as UTF-8, so names with accents display correctly.
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  const last = new Date(range.value.to.getTime() - 1)
  link.href = url
  link.download = `timesheet-${dateKey(range.value.from)}-to-${dateKey(last)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Filters -->
    <div class="card card-border bg-base-100 space-y-3 p-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <select v-model="preset" class="select w-full" aria-label="Period">
          <option v-for="p in presets" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
        <select v-model="projectFilter" class="select w-full" aria-label="Project">
          <option value="">All projects</option>
          <option v-for="p in time.projects" :key="p.id" :value="p.id">
            {{ p.name }}{{ p.archived ? ' (archived)' : '' }}
          </option>
          <option value="none">No project</option>
        </select>
      </div>
      <div v-if="preset === 'custom'" class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs">
          <span class="text-base-content/60 mb-1 block">From</span>
          <input v-model="customFrom" type="date" class="input w-full" />
        </label>
        <label class="text-xs">
          <span class="text-base-content/60 mb-1 block">To (included)</span>
          <input v-model="customTo" type="date" class="input w-full" />
        </label>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-24 w-full"></div>
      <div class="skeleton h-40 w-full"></div>
    </div>

    <template v-else>
      <!-- Totals -->
      <div class="grid grid-cols-2 gap-3">
        <div class="card card-border bg-base-100 p-4">
          <p class="text-base-content/60 text-sm">Total time</p>
          <p class="text-3xl font-bold tabular-nums">{{ formatHours(totalSeconds) }}</p>
          <p class="text-base-content/60 text-xs">{{ decimalHours(totalSeconds) }} hours</p>
        </div>
        <div class="card card-border bg-base-100 p-4">
          <p class="text-base-content/60 text-sm">Earnings</p>
          <p v-if="hasRates" class="text-3xl font-bold tabular-nums">{{ formatMoney(totalAmount, time.currency) }}</p>
          <p v-else class="text-base-content/50 pt-1 text-sm">Add an hourly rate to a project to see earnings.</p>
        </div>
      </div>

      <p v-if="!filtered.length" class="text-base-content/60 py-8 text-center text-sm">
        No time logged in this period.
      </p>

      <template v-else>
        <!-- Hours per day -->
        <section class="card card-border bg-base-100 p-4">
          <h2 class="mb-3 font-semibold">Hours per day</h2>
          <div class="flex h-32 items-end gap-1" role="img" aria-label="Bar chart of hours worked per day">
            <div v-for="d in perDay" :key="d.key" class="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div
                class="bg-primary rounded-t"
                :style="{ height: `${(d.seconds / busiestDay) * 100}%`, minHeight: d.seconds ? '3px' : '0' }"
                :title="`${dayLabel(d)}: ${formatHours(d.seconds)}`"
              ></div>
            </div>
          </div>
          <div v-if="perDay.length <= 14" class="mt-1 flex gap-1">
            <span
              v-for="d in perDay"
              :key="d.key"
              class="text-base-content/60 min-w-0 flex-1 truncate text-center text-[0.65rem]"
            >
              {{ dayLabel(d) }}
            </span>
          </div>
        </section>

        <!-- By project -->
        <section class="card card-border bg-base-100 space-y-4 p-4">
          <h2 class="font-semibold">By project</h2>
          <div v-for="g in summary" :key="g.projectId ?? 'none'" class="space-y-1.5">
            <div class="flex items-baseline justify-between gap-3">
              <p class="flex min-w-0 items-center gap-2 font-medium">
                <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: g.color }"></span>
                <span class="truncate">{{ g.name }}</span>
                <span v-if="g.client" class="text-base-content/50 truncate text-xs">{{ g.client }}</span>
              </p>
              <p class="text-sm whitespace-nowrap tabular-nums">
                <strong>{{ formatHours(g.seconds) }}</strong>
                <span v-if="g.amount !== null" class="text-base-content/60">
                  · {{ formatMoney(g.amount, time.currency) }}
                </span>
              </p>
            </div>
            <div class="bg-base-200 h-2 overflow-hidden rounded-full">
              <div
                class="h-full rounded-full"
                :style="{ width: `${(g.seconds / totalSeconds) * 100}%`, backgroundColor: g.color }"
              ></div>
            </div>
            <ul v-if="g.tasks.length > 1 || g.tasks[0]?.taskId" class="text-base-content/70 space-y-0.5 pl-5 text-xs">
              <li v-for="t in g.tasks" :key="t.taskId ?? 'none'" class="flex justify-between gap-3">
                <span class="truncate">{{ taskName(t.taskId) }}</span>
                <span class="tabular-nums">{{ formatHours(t.seconds) }}</span>
              </li>
            </ul>
          </div>
        </section>

        <button class="btn btn-outline" @click="exportCsv">
          <Download class="size-4" /> Export timesheet (CSV)
        </button>
      </template>
    </template>
  </div>
</template>
