<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AlarmClock, Bell, BellOff, CheckCheck, Clock, Timer, Trash2, X } from 'lucide-vue-next'
import { timeAgo } from '@/lib/notifications'
import { useNotificationsStore } from '@/stores/notifications'
import { useRemindersStore } from '@/stores/reminders'
import TaskModal from '@/components/TaskModal.vue'

// The bell in the top bar. A red badge counts unread notifications; clicking it opens a
// list that floats under the button, like Facebook's.
const notifications = useNotificationsStore()
const reminders = useRemindersStore()
const route = useRoute()
const open = ref(false)
const root = ref(null)
const filter = ref('all') // 'all' | 'unread'
const openTaskId = ref(null)

const shown = computed(() =>
  filter.value === 'unread' ? notifications.items.filter((n) => !n.read) : notifications.items
)
const badge = computed(() => (notifications.unreadCount > 9 ? '9+' : notifications.unreadCount))

// Re-render the "5m ago" labels every minute while the list is open.
const now = ref(new Date())
let ticker = null
watch(open, (isOpen) => {
  clearInterval(ticker)
  if (isOpen) {
    now.value = new Date()
    ticker = setInterval(() => (now.value = new Date()), 60 * 1000)
  }
})

// Give the bell a little shake when something new comes in.
const ringing = ref(false)
watch(
  () => notifications.unreadCount,
  (count, before) => {
    if (count > before) {
      ringing.value = false
      requestAnimationFrame(() => (ringing.value = true))
    }
  }
)

const icons = { soon: AlarmClock, overdue: Clock, timer: Timer }
const tones = {
  soon: 'bg-warning/15 text-warning',
  overdue: 'bg-error/15 text-error',
  timer: 'bg-primary/15 text-primary'
}

function closeOnOutsideClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
function closeOnEscape(event) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
  clearInterval(ticker)
})
watch(
  () => route.fullPath,
  () => (open.value = false)
)

// Clicking a task reminder opens that task right here, whatever page you're on.
function select(item) {
  notifications.markRead(item.id)
  if (item.taskId) {
    open.value = false
    openTaskId.value = item.taskId
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="btn btn-ghost btn-circle relative"
      :class="{ 'bg-base-200': open }"
      :aria-label="`Notifications${notifications.unreadCount ? `, ${notifications.unreadCount} unread` : ''}`"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Bell class="size-5" :class="{ 'bell-ring': ringing }" @animationend="ringing = false" />
      <span
        v-if="notifications.unreadCount"
        class="bg-error text-error-content ring-base-100 absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] leading-none font-bold ring-2"
        aria-hidden="true"
      >
        {{ badge }}
      </span>
    </button>

    <Transition name="pop">
      <!-- On phones the panel spans the screen under the top bar; on wider screens it hangs
           from the bell. -->
      <div
        v-if="open"
        class="bg-base-100 border-base-300 rounded-box fixed inset-x-2 top-full z-40 mt-2 flex max-h-[75vh] flex-col overflow-hidden border shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:w-96"
        role="dialog"
        aria-label="Notifications"
      >
        <!-- Little arrow pointing at the bell -->
        <span
          class="bg-base-100 border-base-300 absolute -top-1.5 right-3.5 hidden size-3 rotate-45 border-t border-l sm:block"
          aria-hidden="true"
        ></span>

        <div class="flex items-center justify-between gap-2 px-4 pt-3">
          <h2 class="text-lg font-bold">Notifications</h2>
          <button
            v-if="notifications.unreadCount"
            class="btn btn-ghost btn-xs text-primary"
            @click="notifications.markAllRead()"
          >
            <CheckCheck class="size-4" /> Mark all as read
          </button>
        </div>

        <div class="flex gap-1 px-4 py-2" role="tablist">
          <button
            v-for="f in ['all', 'unread']"
            :key="f"
            class="btn btn-sm rounded-full capitalize"
            :class="filter === f ? 'btn-primary btn-soft' : 'btn-ghost'"
            role="tab"
            :aria-selected="filter === f"
            @click="filter = f"
          >
            {{ f }}
          </button>
        </div>

        <ul v-if="shown.length" class="flex-1 overflow-y-auto px-2 pb-2">
          <li v-for="n in shown" :key="n.id" class="group relative">
            <button
              class="hover:bg-base-200 flex w-full items-start gap-3 rounded-lg p-2 pr-8 text-left"
              @click="select(n)"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-full"
                :class="tones[n.kind] ?? 'bg-base-200'"
              >
                <component :is="icons[n.kind] ?? Bell" class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block text-sm"
                  :class="n.read ? 'text-base-content/70' : 'font-semibold'"
                >
                  {{ n.title }}
                </span>
                <span v-if="n.body" class="text-base-content/60 block text-xs">{{ n.body }}</span>
                <span
                  class="mt-0.5 block text-xs"
                  :class="n.read ? 'text-base-content/50' : 'text-primary font-medium'"
                >
                  {{ timeAgo(n.createdAt, now) }}
                </span>
              </span>
              <span
                v-if="!n.read"
                class="bg-primary mt-4 size-2.5 shrink-0 rounded-full"
                aria-label="Unread"
              ></span>
            </button>
            <button
              class="btn btn-ghost btn-xs btn-circle absolute top-2 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-60"
              aria-label="Remove notification"
              @click="notifications.remove(n.id)"
            >
              <X class="size-3.5" />
            </button>
          </li>
        </ul>

        <div
          v-else
          class="text-base-content/60 flex flex-col items-center gap-2 px-4 py-10 text-center text-sm"
        >
          <BellOff class="size-8 opacity-50" />
          {{ filter === 'unread' ? "You're all caught up." : 'No notifications yet.' }}
          <span class="text-xs">Reminders for tasks due soon or overdue show up here.</span>
        </div>

        <div class="border-base-300 flex items-center justify-between gap-2 border-t px-4 py-2">
          <button
            v-if="reminders.permission === 'default'"
            class="btn btn-ghost btn-xs"
            @click="reminders.requestPermission()"
          >
            Also show system pop-ups
          </button>
          <span v-else></span>
          <button
            v-if="notifications.items.length"
            class="btn btn-ghost btn-xs text-error"
            @click="notifications.clearAll()"
          >
            <Trash2 class="size-3.5" /> Clear all
          </button>
        </div>
      </div>
    </Transition>

    <!-- Teleported so the blurred top bar doesn't trap the modal's overlay inside it. -->
    <Teleport to="body">
      <TaskModal v-if="openTaskId" :task-id="openTaskId" @close="openTaskId = null" />
    </Teleport>
  </div>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  transform-origin: top right;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.bell-ring {
  transform-origin: top center;
  animation: ring 0.8s ease;
}
@keyframes ring {
  0%,
  100% {
    transform: rotate(0);
  }
  15% {
    transform: rotate(14deg);
  }
  30% {
    transform: rotate(-12deg);
  }
  45% {
    transform: rotate(9deg);
  }
  60% {
    transform: rotate(-6deg);
  }
  75% {
    transform: rotate(3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pop-enter-active,
  .pop-leave-active {
    transition: none;
  }
  .bell-ring {
    animation: none;
  }
}
</style>
