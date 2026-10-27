<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronUp, GripVertical, Maximize2, Pin, Square, X } from 'lucide-vue-next'
import { durationSeconds, formatHours, rangeFor } from '@/lib/time'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'

// The floating timer you get by pressing "Minimize" on the Tracker page. It stays on screen on
// every page while a timer runs.
// Unpinned, it shrinks to a small pill when you click somewhere else or change page.
// Pinned, it stays open until you shrink it yourself. Drag it to move it to another corner.
// In Chrome and Edge, pinning goes further: the timer moves into a small always-on-top window
// (Picture-in-Picture), so it floats above every tab and every other app until you unpin it.
const time = useTimeStore()
const toast = useToastStore()
const route = useRoute()

const root = ref(null)
const visible = computed(() => time.mini.open && !!time.running)
const expanded = computed(() => time.mini.expanded)

// ---------- The always-on-top window ----------
// Where supported, "pinned" simply means "the floating window is open". Browsers only allow
// opening it from a click, so it can't be brought back by itself after a refresh.
const floatSupported = 'documentPictureInPicture' in window
let floatWindow = null
const floatBody = ref(null) // the element inside that window the timer is drawn into
const pinned = computed(() => (floatSupported ? !!floatBody.value : time.mini.pinned))
const showCard = computed(() => expanded.value || !!floatBody.value)

// The new window starts empty, so give it the page's styles and theme.
function copyStyles(target) {
  for (const attr of document.documentElement.attributes) {
    target.documentElement.setAttribute(attr.name, attr.value)
  }
  for (const sheet of document.styleSheets) {
    let node
    try {
      node = target.createElement('style')
      node.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
    } catch {
      if (!sheet.href) continue // a style sheet from another site can't be read
      node = target.createElement('link')
      node.rel = 'stylesheet'
      node.href = sheet.href
    }
    target.head.append(node)
  }
}

async function openFloat() {
  try {
    const win = await window.documentPictureInPicture.requestWindow({ width: 340, height: 300 })
    copyStyles(win.document)
    win.document.title = 'Timer'
    win.document.body.style.margin = '0'
    const box = win.document.createElement('div')
    box.className = 'bg-base-100 text-base-content min-h-screen'
    win.document.body.append(box)
    win.addEventListener('pagehide', () => closeFloat(win))
    floatWindow = win
    floatBody.value = box
  } catch (e) {
    toast.error(`Could not open the floating timer: ${e.message}`)
  }
}

// Closing the window (with its own x or from here) puts the timer back in the page.
function closeFloat(win = floatWindow) {
  if (!win || win !== floatWindow) return
  floatWindow = null
  floatBody.value = null
  win.close()
}

const running = computed(() => time.running)
const project = computed(() => time.runningProject)
const taskName = computed(() => time.taskById.get(running.value?.task_id)?.name ?? '')
const startedAt = computed(() =>
  new Date(running.value.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
)
const todaySeconds = computed(() => time.secondsIn(rangeFor('today')))

// The pulsing dot takes the project's colour.
const dot = computed(() =>
  project.value ? { style: { backgroundColor: project.value.color } } : { class: 'bg-secondary' }
)

// ---------- Opening, shrinking, pinning ----------
const expand = () => time.setMini({ expanded: true })
const collapse = () => time.setMini({ expanded: false })
function togglePin() {
  if (!floatSupported) return time.setMini({ pinned: !pinned.value })
  if (floatWindow) closeFloat()
  else openFloat()
}

// From the floating window, bring the app's own tab to the front.
const focusApp = () => window.focus()

function collapseUnlessPinned() {
  if (visible.value && expanded.value && !pinned.value) collapse()
}

function hide() {
  time.setMini({ open: false })
  toast.show('Mini timer hidden. The timer keeps running.', {
    action: { label: 'Undo', handler: () => time.setMini({ open: true }) }
  })
}

function closeOnOutsideClick(event) {
  if (root.value && !root.value.contains(event.target)) collapseUnlessPinned()
}
onMounted(() => document.addEventListener('pointerdown', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsideClick))
watch(() => route.fullPath, collapseUnlessPinned)

// Nothing to show once the timer stops or is hidden, and the window is no use empty.
watch(visible, (now) => !now && closeFloat())
onBeforeUnmount(() => closeFloat())

const stopping = ref(false)
async function stop() {
  const seconds = durationSeconds(running.value, Date.now())
  stopping.value = true
  try {
    await time.stop()
    toast.success(`Logged ${formatHours(seconds)}`)
  } catch (e) {
    toast.error(`Could not stop the timer: ${e.message}`)
  } finally {
    stopping.value = false
  }
}

// ---------- Dragging it to another corner ----------
// Room is left for the top bar, and on phones for the tab bar at the bottom.
const corners = {
  'top-left': 'left-4 top-[calc(4.5rem+env(safe-area-inset-top))]',
  'top-right': 'right-4 top-[calc(4.5rem+env(safe-area-inset-top))]',
  'bottom-left': 'left-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6',
  'bottom-right': 'right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6'
}
const cornerClass = computed(() => corners[time.mini.corner] ?? corners['bottom-right'])

const offset = ref(null) // { x, y } while it's being dragged
let drag = null
let justDragged = false // the click that ends a drag shouldn't also open the pill

function startDrag(event) {
  if (floatBody.value || event.button !== 0 || event.target.closest('[data-no-drag]')) return
  // `box` is where it sat before moving, so the drop point doesn't depend on the screen having redrawn.
  drag = {
    x: event.clientX,
    y: event.clientY,
    moved: false,
    box: root.value.getBoundingClientRect()
  }
  window.addEventListener('pointermove', moveDrag)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function moveDrag(event) {
  const x = event.clientX - drag.x
  const y = event.clientY - drag.y
  if (!drag.moved && Math.hypot(x, y) < 6) return // a small wobble is still a click
  drag.moved = true
  offset.value = { x, y }
}

// Snaps to the nearest corner, then glides there from where it was dropped.
async function endDrag() {
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  const { moved, box } = drag ?? {}
  drag = null
  if (!moved || !root.value) return

  justDragged = true
  setTimeout(() => (justDragged = false))
  const dropped = { left: box.left + offset.value.x, top: box.top + offset.value.y }
  const x = dropped.left + box.width / 2
  const y = dropped.top + box.height / 2
  time.setMini({
    corner: `${y < window.innerHeight / 2 ? 'top' : 'bottom'}-${x < window.innerWidth / 2 ? 'left' : 'right'}`
  })
  offset.value = null

  await nextTick()
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const settled = root.value.getBoundingClientRect()
  root.value.animate?.(
    [
      { transform: `translate(${dropped.left - settled.left}px, ${dropped.top - settled.top}px)` },
      { transform: 'none' }
    ],
    { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
  )
}
onBeforeUnmount(() => endDrag())

function onPillClick() {
  if (!justDragged) expand()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
    enter-from-class="translate-y-3 scale-95 opacity-0"
    leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
    leave-to-class="translate-y-3 scale-95 opacity-0"
  >
    <section
      v-if="visible"
      ref="root"
      class="fixed z-20 select-none"
      :class="[cornerClass, { hidden: floatBody }]"
      :style="offset && { transform: `translate(${offset.x}px, ${offset.y}px)` }"
      aria-label="Running timer"
      @keydown.esc="collapseUnlessPinned"
    >
      <!-- While floating, the timer is drawn inside the other window instead of here -->
      <Teleport :to="floatBody ?? 'body'" :disabled="!floatBody">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
          enter-from-class="scale-95 opacity-0"
          leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
          leave-to-class="scale-95 opacity-0"
        >
          <!-- All the details -->
          <div
            v-if="showCard"
            key="card"
            class="bg-base-100 bg-linear-to-b from-primary/10 to-transparent to-60%"
            :class="
              floatBody
                ? 'flex min-h-screen flex-col'
                : [
                    'rounded-box w-72 max-w-[calc(100vw-2rem)] overflow-hidden border shadow-xl',
                    pinned ? 'border-primary/50' : 'border-base-300',
                    { 'shadow-2xl': offset }
                  ]
            "
          >
            <header
              class="flex touch-none items-center gap-1.5 py-1.5 ps-2 pe-1.5"
              :class="floatBody ? '' : offset ? 'cursor-grabbing' : 'cursor-grab'"
              :title="floatBody ? undefined : 'Drag to move'"
              @pointerdown="startDrag"
            >
              <GripVertical
                v-if="!floatBody"
                class="text-base-content/30 size-4 shrink-0"
                aria-hidden="true"
              />
              <span class="relative flex size-2.5 shrink-0" aria-hidden="true">
                <span
                  class="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
                  :class="dot.class"
                  :style="dot.style"
                ></span>
                <span
                  class="relative inline-flex size-2.5 rounded-full"
                  :class="dot.class"
                  :style="dot.style"
                ></span>
              </span>
              <span class="text-base-content/60 flex-1 text-xs font-semibold">
                {{
                  floatBody ? 'Tracking · on top' : pinned ? 'Tracking · pinned' : 'Tracking time'
                }}
              </span>

              <button
                type="button"
                data-no-drag
                class="btn btn-ghost btn-xs btn-square"
                :class="{ 'text-primary': pinned }"
                :aria-pressed="pinned"
                :aria-label="pinned ? 'Unpin' : 'Pin open'"
                :title="
                  floatSupported
                    ? pinned
                      ? 'Unpin: bring it back into the page'
                      : 'Pin on top: float above every tab and app'
                    : pinned
                      ? 'Unpin: shrink again when I click elsewhere'
                      : 'Pin open: stay open on every page'
                "
                @click="togglePin"
              >
                <Pin
                  class="size-3.5 transition-transform"
                  :class="pinned ? 'fill-current' : 'rotate-45'"
                />
              </button>
              <button
                v-if="!floatBody"
                type="button"
                data-no-drag
                class="btn btn-ghost btn-xs btn-square"
                aria-label="Shrink"
                title="Shrink to a small pill"
                @click="collapse"
              >
                <ChevronDown class="size-4" />
              </button>
              <button
                v-if="!floatBody"
                type="button"
                data-no-drag
                class="btn btn-ghost btn-xs btn-square"
                aria-label="Hide the mini timer"
                title="Hide the mini timer (the timer keeps running)"
                @click="hide"
              >
                <X class="size-4" />
              </button>
            </header>

            <!-- Everything centred: project, big clock, what you're doing -->
            <div
              class="flex flex-col items-center px-5 pt-1 pb-4 text-center"
              :class="{ 'flex-1 justify-center': floatBody }"
            >
              <span
                class="bg-base-200 text-base-content/80 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              >
                <span
                  class="size-2 shrink-0 rounded-full"
                  :class="{ 'border-base-300 border': !project }"
                  :style="project && { backgroundColor: project.color }"
                ></span>
                <span class="truncate">
                  {{ project?.name ?? 'No project'
                  }}<template v-if="taskName"> · {{ taskName }}</template>
                </span>
              </span>

              <p
                class="text-primary mt-3 text-5xl leading-none font-extrabold tracking-tight tabular-nums"
                role="timer"
              >
                {{ time.clock }}
              </p>

              <p
                class="mt-3 line-clamp-2 text-sm font-medium wrap-break-word select-text"
                :class="{ 'text-base-content/50 italic': !running.description }"
              >
                {{ running.description || 'No description' }}
              </p>
              <p class="text-base-content/50 mt-1 text-xs">
                Started {{ startedAt }} · Today
                <strong class="text-base-content/70 tabular-nums">{{
                  formatHours(todaySeconds)
                }}</strong>
              </p>
            </div>

            <footer class="flex items-center gap-2 px-4 pb-4">
              <RouterLink
                v-if="route.path !== '/time' || floatBody"
                to="/time"
                class="btn btn-soft btn-circle"
                aria-label="Open the tracker"
                title="Open the tracker"
                @click="focusApp"
              >
                <Maximize2 class="size-4" />
              </RouterLink>
              <button
                type="button"
                class="btn btn-error flex-1 rounded-full"
                :disabled="stopping"
                @click="stop"
              >
                <span v-if="stopping" class="loading loading-spinner loading-xs"></span>
                <Square v-else class="size-3.5 fill-current" />
                Stop timer
              </button>
            </footer>
          </div>

          <!-- Shrunk to a pill: just the clock and the project -->
          <button
            v-else
            key="pill"
            type="button"
            class="bg-base-100 border-base-300 hover:border-primary/50 flex touch-none items-center gap-2 rounded-full border py-2 ps-3 pe-2.5 shadow-lg transition-colors"
            :class="offset ? 'cursor-grabbing shadow-xl' : 'cursor-pointer'"
            title="Show details (drag to move)"
            @pointerdown="startDrag"
            @click="onPillClick"
          >
            <span class="relative flex size-2.5 shrink-0" aria-hidden="true">
              <span
                class="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
                :class="dot.class"
                :style="dot.style"
              ></span>
              <span
                class="relative inline-flex size-2.5 rounded-full"
                :class="dot.class"
                :style="dot.style"
              ></span>
            </span>
            <span class="text-sm font-bold tabular-nums">{{ time.clock }}</span>
            <span v-if="project" class="text-base-content/60 max-w-32 truncate text-xs">{{
              project.name
            }}</span>
            <span class="sr-only">Show the timer details</span>
            <ChevronUp class="text-base-content/50 size-4 shrink-0" aria-hidden="true" />
          </button>
        </Transition>
      </Teleport>
    </section>
  </Transition>
</template>
