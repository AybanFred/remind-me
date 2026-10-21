<script setup>
import { computed, onMounted } from 'vue'
import { Pause, Play, RotateCcw, Volume2, VolumeOff } from 'lucide-vue-next'
import { useFocusStore } from '@/stores/focus'
import { useTasksStore } from '@/stores/tasks'

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
  <div class="space-y-6">
    <div class="card card-border bg-base-100 items-center gap-6 p-6">
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
        :class="focus.mode === 'focus' ? 'text-primary' : 'text-secondary'"
        :style="{ '--value': focus.percentDone, '--size': '15rem', '--thickness': '0.75rem' }"
        role="timer"
        :aria-label="`${focus.display} remaining`"
      >
        <div class="text-base-content text-center">
          <p class="text-5xl font-bold tabular-nums">{{ focus.display }}</p>
          <p class="text-base-content/60 mt-1 text-sm">
            {{ focus.mode === 'focus' ? 'Stay with it' : 'Rest your eyes' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button v-if="!focus.running" class="btn btn-primary btn-lg px-8" @click="focus.start()">
          <Play class="size-5" />
          {{ focus.remaining < focus.total ? 'Resume' : 'Start' }}
        </button>
        <button v-else class="btn btn-warning btn-lg px-8" @click="focus.pause()">
          <Pause class="size-5" /> Pause
        </button>
        <button class="btn btn-outline btn-lg btn-square" aria-label="Reset timer" @click="focus.reset()">
          <RotateCcw class="size-5" />
        </button>
        <button
          class="btn btn-ghost btn-lg btn-square"
          :aria-label="focus.soundOn ? 'Mute the end-of-session sound' : 'Unmute the end-of-session sound'"
          @click="focus.toggleSound()"
        >
          <Volume2 v-if="focus.soundOn" class="size-5" />
          <VolumeOff v-else class="text-base-content/50 size-5" />
        </button>
      </div>

      <label v-if="focus.mode === 'focus'" class="w-full max-w-xs">
        <span class="text-base-content/60 mb-1 block text-sm">Working on</span>
        <select
          :value="focus.taskId ?? ''"
          :disabled="focus.running"
          class="select w-full"
          @change="focus.setTask($event.target.value || null)"
        >
          <option value="">No specific task</option>
          <option v-for="t in openTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </label>

      <p class="text-base-content/50 text-xs">
        Your timer is saved, so a refresh won't lose it.
      </p>
    </div>

    <section class="space-y-3">
      <h2 class="flex items-center justify-between font-semibold">
        Today
        <span class="badge badge-primary">{{ focus.todayMinutes }} min focused</span>
      </h2>
      <p v-if="!focus.todaySessions.length" class="text-base-content/60 text-sm">
        No focus sessions yet today. Press Start to begin your first one.
      </p>
      <ul class="space-y-2">
        <li
          v-for="s in focus.todaySessions"
          :key="s.id"
          class="card card-border bg-base-100 flex-row items-center justify-between gap-3 p-3 text-sm"
        >
          <span class="truncate">{{ s.tasks?.title ?? 'No specific task' }}</span>
          <span class="text-base-content/60 shrink-0">{{ timeOf(s.started_at) }} · {{ s.minutes_focused }} min</span>
        </li>
      </ul>
    </section>
  </div>
</template>
