<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sofa,
  Sun,
  Sunrise,
  X
} from 'lucide-vue-next'
import { monthGrid } from '@/lib/calendar'
import { dateKey } from '@/lib/stats'
import { defaultTimeFor, duePresets, formatDueLabel, relativeDue, toLocalInput } from '@/lib/dates'

// A friendlier replacement for <input type="datetime-local"> for a task's due date: one-tap
// choices (Today, Tomorrow...), a small month calendar and common times. It uses v-model with
// the same "2026-10-21T14:30" string the native input uses, and '' for "no due date".
// On phones it opens as a sheet from the bottom of the screen, elsewhere as a pop-up below the field.
const model = defineModel({ type: String, default: '' })
defineProps({ small: { type: Boolean, default: false } })

const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const panel = ref(null)
const now = ref(new Date()) // refreshed every time the picker opens

const day = computed(() => model.value.split('T')[0])
const time = computed(() => model.value.split('T')[1] ?? '')
const label = computed(() => (model.value ? formatDueLabel(model.value, now.value) : ''))
const isPast = computed(() => !!model.value && new Date(model.value) < now.value)
const todayKey = computed(() => dateKey(now.value))

const presetIcons = { today: Sun, tomorrow: Sunrise, weekend: Sofa, next_week: CalendarRange }
const presets = computed(() =>
  duePresets(now.value).map((p) => ({
    ...p,
    value: toLocalInput(p.date),
    hint: p.date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  }))
)

const quickTimes = [9, 12, 15, 18, 21].map((hour) => ({
  value: `${String(hour).padStart(2, '0')}:00`,
  label: new Date(2026, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })
}))

// ---------- The month calendar ----------
const view = ref({ year: 0, month: 0 }) // month is 0-11
const focusKey = ref('') // the day that arrow keys move from
const days = computed(() => monthGrid(view.value.year, view.value.month))
const monthTitle = computed(() =>
  new Date(view.value.year, view.value.month, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  })
)
const showingThisMonth = computed(
  () => view.value.year === now.value.getFullYear() && view.value.month === now.value.getMonth()
)

// Mon, Tue, ... in the user's language (26 Oct 2026 is a Monday).
const weekdays = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 9, 26 + i).toLocaleDateString([], { weekday: 'short' })
)

const parseKey = (key) => key.split('-').map(Number)

function showMonthOf(key) {
  const [y, m] = parseKey(key)
  view.value = { year: y, month: m - 1 }
}

function shiftDay(key, step) {
  const [y, m, d] = parseKey(key)
  return dateKey(new Date(y, m - 1, d + step, 12))
}

// The same day of the month `step` months away, kept inside shorter months (31 Jan -> 28 Feb).
function shiftMonth(key, step) {
  const [y, m, d] = parseKey(key)
  const lastDay = new Date(y, m - 1 + step + 1, 0).getDate()
  return dateKey(new Date(y, m - 1 + step, Math.min(d, lastDay), 12))
}

function changeMonth(step) {
  focusKey.value = shiftMonth(focusKey.value, step)
  showMonthOf(focusKey.value)
}

function goToToday() {
  focusKey.value = todayKey.value
  showMonthOf(focusKey.value)
}

function dayClass(d) {
  if (d.key === day.value) return 'bg-primary text-primary-content font-semibold'
  const muted = !d.inMonth || d.key < todayKey.value
  return [
    'hover:bg-base-200',
    d.key === todayKey.value ? 'text-primary ring-primary/50 font-bold ring-1' : '',
    muted ? 'text-base-content/40' : ''
  ]
}

function focusDay() {
  panel.value?.querySelector(`[data-day="${focusKey.value}"]`)?.focus()
}

// Arrow keys move a day or a week, Page Up / Page Down a month.
function onDayKeydown(event) {
  const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  let next
  if (event.key in steps) {
    next = shiftDay(focusKey.value, steps[event.key])
  } else if (event.key === 'PageUp' || event.key === 'PageDown') {
    next = shiftMonth(focusKey.value, event.key === 'PageUp' ? -1 : 1)
  } else {
    return
  }
  event.preventDefault()
  focusKey.value = next
  showMonthOf(next)
  nextTick(focusDay)
}

// ---------- Changing the value ----------
function setDay(key) {
  model.value = `${key}T${time.value || defaultTimeFor(key, now.value)}`
  focusKey.value = key
  showMonthOf(key) // picking a grey day from the next or previous month jumps to that month
}

function setTime(value) {
  if (!value) return // the browser's time box is empty while it's half typed
  let key = day.value
  if (!key) {
    // No day yet: today, or tomorrow if that time has already passed today.
    key = todayKey.value
    if (new Date(`${key}T${value}`) < now.value) key = shiftDay(key, 1)
    focusKey.value = key
    showMonthOf(key)
  }
  model.value = `${key}T${value}`
}

function pickPreset(preset) {
  model.value = preset.value
  close()
}

function clear() {
  model.value = ''
  close()
}

// ---------- Opening, closing and placing the pop-up ----------
const isPhone = ref(false)
const panelStyle = ref({})

function openPicker() {
  now.value = new Date()
  focusKey.value = day.value || todayKey.value
  showMonthOf(focusKey.value)
  isPhone.value = window.matchMedia('(max-width: 639px)').matches
  open.value = true
  nextTick(() => {
    place()
    focusDay()
  })
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

// Below the field, or above it when there's more room there. Kept inside the window.
function place() {
  isPhone.value = window.matchMedia('(max-width: 639px)').matches
  if (isPhone.value || !root.value || !panel.value) {
    panelStyle.value = {}
    return
  }
  const field = root.value.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = panel.value
  const gap = 6
  const roomBelow = window.innerHeight - field.bottom
  const top =
    roomBelow >= height + gap + 8 || roomBelow >= field.top
      ? field.bottom + gap
      : Math.max(8, field.top - gap - height)
  const left = Math.max(8, Math.min(field.left, window.innerWidth - width - 8))
  panelStyle.value = { top: `${top}px`, left: `${left}px` }
}

const isInside = (el) => !!el && (root.value?.contains(el) || panel.value?.contains(el))

// Escape closes the picker without also closing a pop-up it's inside (like the task pop-up).
function closeOnEscape(event) {
  if (!open.value) return
  event.stopPropagation()
  close()
}

function closeOnOutsideClick(event) {
  // On phones the dimmed backdrop handles this with its own click.
  if (!isPhone.value && !isInside(event.target)) close(false)
}

// Tabbing out of the picker closes it, so it isn't left open behind you.
function closeOnFocusLeave(event) {
  if (open.value && event.relatedTarget && !isInside(event.relatedTarget)) close(false)
}

function listen(on) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', closeOnOutsideClick)
  window[method]('resize', place)
  window[method]('scroll', place, true) // true: also when a box the field is inside scrolls
}
watch(open, listen)
onBeforeUnmount(() => listen(false))
</script>

<template>
  <div
    ref="root"
    class="input w-full gap-2 pe-1"
    :class="{ 'input-sm': small }"
    @keydown.esc="closeOnEscape"
    @focusout="closeOnFocusLeave"
  >
    <button
      ref="trigger"
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left outline-none"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="model ? `Due ${label}. Change the due date` : 'Add a due date'"
      @click="open ? close() : openPicker()"
    >
      <CalendarDays class="size-4 shrink-0" :class="isPast ? 'text-error' : 'opacity-60'" />
      <span v-if="model" class="truncate" :class="{ 'text-error font-medium': isPast }">
        {{ label }}
      </span>
      <span v-else class="text-base-content/50 truncate">Add due date</span>
    </button>
    <button
      v-if="model"
      type="button"
      class="btn btn-ghost btn-circle btn-xs"
      aria-label="Remove the due date"
      @click="model = ''"
    >
      <X class="size-3.5" />
    </button>

    <!-- In <body>, so the pop-up isn't cut off by a scrolling box (like the task pop-up) around the field -->
    <Teleport to="body">
      <div
        v-if="open && isPhone"
        class="fixed inset-0 z-[1000] bg-black/40"
        @click="close(false)"
      ></div>

      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-label="Choose a due date"
        class="bg-base-100 border-base-300 fixed z-[1001] space-y-3 overflow-y-auto border p-3 shadow-xl"
        :class="
          isPhone
            ? 'rounded-t-box inset-x-0 bottom-0 max-h-[85vh] pb-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'rounded-box max-h-[calc(100vh-1rem)] w-80'
        "
        :style="panelStyle"
        @keydown.esc="closeOnEscape"
        @focusout="closeOnFocusLeave"
      >
        <!-- What's chosen right now -->
        <header class="flex items-start justify-between gap-2 px-1">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ model ? label : 'No due date' }}</p>
            <p class="text-xs" :class="isPast ? 'text-error' : 'text-base-content/60'">
              <template v-if="!model">Pick a day and a time</template>
              <template v-else-if="isPast">Already passed · {{ relativeDue(model, now) }}</template>
              <template v-else>Due {{ relativeDue(model, now) }}</template>
            </p>
          </div>
          <button
            v-if="isPhone"
            type="button"
            class="btn btn-ghost btn-sm btn-square -mt-1"
            aria-label="Close"
            @click="close()"
          >
            <X class="size-5" />
          </button>
        </header>

        <!-- One-tap choices -->
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in presets"
            :key="p.key"
            type="button"
            class="rounded-field flex items-center gap-2 border px-2.5 py-2 text-left transition-colors"
            :class="
              model === p.value
                ? 'border-primary bg-primary/10'
                : 'border-base-300 hover:bg-base-200'
            "
            @click="pickPreset(p)"
          >
            <component :is="presetIcons[p.key]" class="text-primary size-4 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm leading-tight font-medium">{{ p.label }}</span>
              <span class="text-base-content/60 block truncate text-xs">{{ p.hint }}</span>
            </span>
          </button>
        </div>

        <!-- Month calendar -->
        <section class="border-base-300 border-t pt-3" aria-label="Calendar">
          <div class="mb-1 flex items-center gap-1 px-1">
            <h3 class="flex-1 text-sm font-semibold" aria-live="polite">{{ monthTitle }}</h3>
            <button
              v-if="!showingThisMonth"
              type="button"
              class="btn btn-ghost btn-xs"
              @click="goToToday"
            >
              Today
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              aria-label="Previous month"
              @click="changeMonth(-1)"
            >
              <ChevronLeft class="size-4" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              aria-label="Next month"
              @click="changeMonth(1)"
            >
              <ChevronRight class="size-4" />
            </button>
          </div>

          <div class="grid grid-cols-7 gap-y-0.5 text-center">
            <span
              v-for="w in weekdays"
              :key="w"
              class="text-base-content/50 py-1 text-[0.7rem] font-medium"
              aria-hidden="true"
            >
              {{ w }}
            </span>
            <button
              v-for="d in days"
              :key="d.key"
              type="button"
              :data-day="d.key"
              :tabindex="d.key === focusKey ? 0 : -1"
              class="focus-visible:outline-primary mx-auto grid size-9 place-items-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
              :class="dayClass(d)"
              :aria-label="
                d.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
              "
              :aria-pressed="d.key === day"
              :aria-current="d.key === todayKey ? 'date' : undefined"
              @click="setDay(d.key)"
              @keydown="onDayKeydown"
            >
              {{ d.date.getDate() }}
            </button>
          </div>
        </section>

        <!-- Time -->
        <section class="border-base-300 space-y-2 border-t pt-3" aria-label="Time">
          <label class="flex items-center justify-between gap-2 px-1">
            <span class="flex items-center gap-1.5 text-sm font-semibold">
              <Clock class="size-4 opacity-60" /> Time
            </span>
            <input
              type="time"
              :value="time"
              class="input input-sm w-32"
              aria-label="Exact time"
              @input="setTime($event.target.value)"
            />
          </label>
          <div class="grid grid-cols-5 gap-1">
            <button
              v-for="t in quickTimes"
              :key="t.value"
              type="button"
              class="btn btn-xs px-0"
              :class="time === t.value ? 'btn-primary' : 'btn-ghost border-base-300'"
              :aria-pressed="time === t.value"
              @click="setTime(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </section>

        <footer class="flex items-center justify-between gap-2 pt-1">
          <button type="button" class="btn btn-ghost btn-sm" :disabled="!model" @click="clear">
            Remove date
          </button>
          <button type="button" class="btn btn-primary btn-sm px-5" @click="close()">Done</button>
        </footer>
      </div>
    </Teleport>
  </div>
</template>
