<script setup>
import { computed, onMounted } from 'vue'
import { useFocusStore } from '@/stores/focus'
import { useTasksStore } from '@/stores/tasks'
import AppHeader from '@/components/AppHeader.vue'

const focus = useFocusStore()
const tasks = useTasksStore()

// Only offer tasks that aren't finished yet.
const openTasks = computed(() => tasks.tasks.filter((t) => t.status !== 'done'))

onMounted(() => {
  tasks.fetchTasks()
  focus.fetchToday()
})

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 p-4">
    <AppHeader />

    <div class="card card-border bg-base-100 items-center gap-5 p-6 shadow-sm">
      <div class="tabs tabs-box">
        <button
          class="tab"
          :class="{ 'tab-active': focus.mode === 'focus' }"
          @click="focus.setMode('focus')"
        >
          Focus · 25 min
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': focus.mode === 'break' }"
          @click="focus.setMode('break')"
        >
          Break · 5 min
        </button>
      </div>

      <!-- daisyUI's radial-progress draws a ring; --value is the percentage filled -->
      <div
        class="radial-progress"
        :class="focus.mode === 'focus' ? 'text-primary' : 'text-success'"
        :style="{ '--value': focus.percentDone, '--size': '14rem', '--thickness': '0.7rem' }"
        role="timer"
      >
        <span class="text-base-content text-5xl font-bold tabular-nums">{{ focus.display }}</span>
      </div>

      <div class="flex gap-3">
        <button v-if="!focus.running" class="btn btn-primary" @click="focus.start()">
          {{ focus.remaining < focus.total ? 'Resume' : 'Start' }}
        </button>
        <button v-else class="btn btn-warning" @click="focus.pause()">Pause</button>
        <button class="btn btn-outline" @click="focus.reset()">Reset</button>
      </div>

      <label v-if="focus.mode === 'focus'" class="w-full max-w-xs">
        <span class="text-base-content/60 mb-1 block text-sm">Working on</span>
        <select v-model="focus.taskId" :disabled="focus.running" class="select w-full">
          <option :value="null">No specific task</option>
          <option v-for="t in openTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </label>

      <p v-if="focus.error" class="text-error text-sm">{{ focus.error }}</p>
    </div>

    <section class="space-y-3">
      <h2 class="flex items-center justify-between font-semibold">
        Today
        <span class="badge badge-primary">{{ focus.todayMinutes }} min focused</span>
      </h2>
      <p v-if="!focus.todaySessions.length" class="text-base-content/60 text-sm">
        No focus sessions yet today.
      </p>
      <ul class="space-y-2">
        <li
          v-for="s in focus.todaySessions"
          :key="s.id"
          class="card card-border bg-base-100 flex-row items-center justify-between p-3 text-sm"
        >
          <span>{{ s.tasks?.title ?? 'No specific task' }}</span>
          <span class="text-base-content/60">{{ timeOf(s.started_at) }} · {{ s.minutes_focused }} min</span>
        </li>
      </ul>
    </section>
  </div>
</template>
