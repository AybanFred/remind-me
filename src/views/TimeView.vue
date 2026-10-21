<script setup>
import { Briefcase, ChartNoAxesColumn, Clock } from 'lucide-vue-next'

// The frame for the three time-tracking pages. Each tab is its own route (/time, /time/projects, /time/reports).
const tabs = [
  { to: '/time', label: 'Tracker', icon: Clock, exact: true },
  { to: '/time/projects', label: 'Projects', icon: Briefcase },
  { to: '/time/reports', label: 'Reports', icon: ChartNoAxesColumn }
]
</script>

<template>
  <div class="space-y-5">
    <nav class="tabs tabs-box w-full" aria-label="Time tracking">
      <RouterLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="tab flex-1 gap-2"
        :active-class="t.exact ? '' : 'tab-active'"
        exact-active-class="tab-active"
      >
        <component :is="t.icon" class="size-4" />
        {{ t.label }}
      </RouterLink>
    </nav>

    <RouterView />
  </div>
</template>
