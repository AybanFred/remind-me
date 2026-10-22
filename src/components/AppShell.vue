<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChartColumn, Clock, ListTodo, Sparkles, Timer } from 'lucide-vue-next'
import { useFocusStore } from '@/stores/focus'
import { useTimeStore } from '@/stores/time'
import AccountMenu from '@/components/AccountMenu.vue'
import AppFooter from '@/components/AppFooter.vue'
import NotificationMenu from '@/components/NotificationMenu.vue'
import ThemeMenu from '@/components/ThemeMenu.vue'

// The frame around every logged-in page: top bar, page content, and (on phones) a bottom tab bar.
const focus = useFocusStore()
const time = useTimeStore()
const route = useRoute()

const nav = [
  // List, Board and Calendar are three views of the same tasks, so they share one tab.
  { to: '/dashboard', label: 'Dashboard', icon: ChartColumn },
  { to: '/', label: 'Tasks', icon: ListTodo, paths: ['/', '/board', '/calendar'] },
  { to: '/focus', label: 'Pomodoro', icon: Timer },
  { to: '/time', label: 'Timekeeper', icon: Clock },
  
  { to: '/coach', label: 'Coach', icon: Sparkles }
]

// Each route says how wide its content may be (route.meta.size). The board needs the most room.
const widths = { narrow: 'max-w-2xl', medium: 'max-w-3xl', wide: 'max-w-5xl' }
const contentWidth = computed(() => widths[route.meta.size] ?? widths.narrow)

function isActive(item) {
  return item.paths ? item.paths.includes(route.path) : route.path.startsWith(item.to)
}

</script>

<template>
  <div class="min-h-screen">
    <header
      class="bg-base-100/85 border-base-300 sticky top-0 z-30 border-b backdrop-blur"
      style="padding-top: env(safe-area-inset-top)"
    >
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold">
          <img src="/icon.svg" alt="" class="size-8" />
          <span class="hidden sm:inline">Remind Me</span>
        </RouterLink>

        <!-- Desktop navigation. Phones use the tab bar at the bottom instead. -->
        <nav class="ml-4 hidden gap-1 md:flex" aria-label="Main">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="hover:bg-base-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
            :class="{ '!bg-primary/10 text-primary': isActive(item) }"
            active-class=""
            exact-active-class=""
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <!-- A running time-tracker entry, visible on every page -->
          <RouterLink
            v-if="time.running"
            to="/time"
            class="badge badge-secondary gap-1.5 tabular-nums"
            aria-label="Time tracker running"
          >
            <span class="bg-secondary-content size-2 animate-pulse rounded-full"></span>
            {{ time.clock }}
          </RouterLink>

          <!-- Shows the running Pomodoro timer on every page and links back to the Focus page -->
          <RouterLink
            v-if="focus.running"
            to="/focus"
            class="badge badge-primary gap-1 tabular-nums"
          >
            <Timer class="size-3.5" />
            {{ focus.display }}
          </RouterLink>

          <ThemeMenu />
          <NotificationMenu />
          <AccountMenu />
        </div>
      </div>
    </header>

    <main class="app-main mx-auto px-4 pt-6" :class="contentWidth">
      <slot />
      <AppFooter />
    </main>

    <!-- Phone tab bar -->
    <nav class="dock md:hidden" aria-label="Main">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="{ 'dock-active': isActive(item) }"
        active-class=""
        exact-active-class=""
      >
        <component :is="item.icon" class="size-5" />
        <span class="dock-label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
