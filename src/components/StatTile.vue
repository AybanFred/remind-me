<script setup>
import { computed } from 'vue'

// A glossy gradient tile like the smart lists in Apple Reminders: icon top-left, a big number
// top-right, label underneath. With `to` it is a link; without, a plain card.
const props = defineProps({
  label: { type: String, required: true },
  count: { type: [Number, String], default: null },
  hint: { type: String, default: '' }, // small text under the label
  tone: { type: String, default: 'blue' },
  to: { type: [String, Object], default: null }
})

// Fixed colours (not theme colours) so the tiles keep their character in every theme.
// The class names are written out in full so Tailwind can find them.
const tones = {
  blue: 'from-sky-400 to-blue-600 shadow-blue-600/35',
  red: 'from-rose-400 to-red-600 shadow-red-600/35',
  graphite: 'from-zinc-500 to-zinc-800 shadow-zinc-900/40',
  orange: 'from-amber-300 to-orange-500 shadow-orange-500/35',
  pink: 'from-pink-400 to-rose-600 shadow-rose-600/35',
  slate: 'from-slate-400 to-slate-600 shadow-slate-600/35',
  violet: 'from-violet-500 to-indigo-700 shadow-indigo-700/35',
  teal: 'from-teal-400 to-emerald-600 shadow-emerald-600/35'
}

const tag = computed(() => (props.to ? 'RouterLink' : 'div'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    class="stat-tile relative isolate flex min-h-28 flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br p-4 text-white shadow-lg ring-1 ring-white/15 ring-inset"
    :class="[tones[tone] ?? tones.blue, { 'stat-tile--link': to }]"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="drop-shadow-sm">
        <slot name="icon" />
      </span>
      <span v-if="count !== null" class="text-4xl leading-none font-bold tabular-nums drop-shadow-sm">
        {{ count }}
      </span>
    </div>
    <div>
      <p class="text-lg leading-tight font-semibold drop-shadow-sm">{{ label }}</p>
      <p v-if="hint" class="text-xs text-white/80">{{ hint }}</p>
      <!-- extra content, e.g. a progress bar -->
      <slot />
    </div>
  </component>
</template>

<style scoped>
/* The "3D" look: a soft light coming from the top-left, and a darker edge at the bottom. */
.stat-tile::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(120% 80% at 15% 0%, rgb(255 255 255 / 0.35), transparent 55%),
    linear-gradient(to bottom, transparent 60%, rgb(0 0 0 / 0.12));
}

.stat-tile--link {
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.stat-tile--link:hover {
  transform: translateY(-2px);
}
.stat-tile--link:active {
  transform: scale(0.97);
}
.stat-tile--link:focus-visible {
  outline: 3px solid var(--color-base-content);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .stat-tile--link,
  .stat-tile--link:hover,
  .stat-tile--link:active {
    transition: none;
    transform: none;
  }
}
</style>
