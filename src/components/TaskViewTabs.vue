<script setup>
import { CalendarDays, Columns3, ListTodo } from 'lucide-vue-next'

// The three ways to look at the same to-do tasks. Shown at the top of each of those pages.
const views = [
  { to: '/', label: 'List', icon: ListTodo },
  { to: '/board', label: 'Board', icon: Columns3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays }
]
</script>

<template>
  <nav class="tabs tabs-box w-full" aria-label="Task views">
    <RouterLink
      v-for="v in views"
      :key="v.to"
      :to="v.to"
      class="tab flex-1 gap-2"
      exact-active-class="tab-active"
    >
      <component :is="v.icon" class="size-4" />
      {{ v.label }}
    </RouterLink>
  </nav>
</template>
