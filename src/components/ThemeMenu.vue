<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Check, Monitor, Palette } from 'lucide-vue-next'
import { applyTheme, currentTheme, themeLabels, themes } from '@/lib/theme'

// The palette button in the top bar. Opens a list of themes, each with a small preview.
const route = useRoute()
const open = ref(false)
const root = ref(null)

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
})
watch(() => route.fullPath, () => (open.value = false))

// The menu stays open after picking, so you can try a few themes in a row.
function pick(name) {
  applyTheme(name)
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="theme-button grid size-10 place-items-center rounded-full text-white"
      :class="{ 'theme-button--open': open }"
      aria-label="Change theme"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Palette class="relative size-5 drop-shadow" />
    </button>

    <div
      v-if="open"
      class="bg-base-100 border-base-300 rounded-box absolute top-full right-0 z-40 mt-2 max-h-[70vh] w-64 overflow-y-auto border p-2 shadow-lg"
      role="menu"
      aria-label="Themes"
    >
      <button
        class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
        role="menuitemradio"
        :aria-checked="currentTheme === ''"
        @click="pick('')"
      >
        <Monitor class="size-5 shrink-0" />
        <span class="flex-1">System</span>
        <Check v-if="currentTheme === ''" class="text-primary size-4" />
      </button>

      <button
        v-for="t in themes"
        :key="t"
        class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
        role="menuitemradio"
        :aria-checked="currentTheme === t"
        @click="pick(t)"
      >
        <!-- A tiny swatch drawn IN that theme, so you can see it before choosing -->
        <span
          :data-theme="t"
          class="bg-base-100 border-base-300 flex shrink-0 gap-0.5 rounded-md border p-1"
          aria-hidden="true"
        >
          <span class="bg-primary size-2.5 rounded-full"></span>
          <span class="bg-secondary size-2.5 rounded-full"></span>
          <span class="bg-accent size-2.5 rounded-full"></span>
        </span>
        <span class="flex-1 capitalize">{{ themeLabels[t] ?? t }}</span>
        <Check v-if="currentTheme === t" class="text-primary size-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* A rainbow button with fixed colours, so it stands out the same way in every theme. */
.theme-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  box-shadow:
    0 4px 14px -4px rgb(139 92 246 / 0.6),
    inset 0 0 0 1.5px rgb(255 255 255 / 0.45);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

/* The colour wheel sits behind the icon on its own layer, so it can spin without moving the icon. */
.theme-button::before {
  content: '';
  position: absolute;
  inset: -25%;
  z-index: -2;
  background: conic-gradient(from 0deg, #f43f5e, #f59e0b, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e);
  transition: transform 0.6s ease;
}

/* A soft highlight from the top for a glossy, slightly 3D look. */
.theme-button::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(90% 70% at 30% 15%, rgb(255 255 255 / 0.45), transparent 60%);
}

.theme-button:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow:
    0 6px 18px -4px rgb(139 92 246 / 0.75),
    inset 0 0 0 1.5px rgb(255 255 255 / 0.55);
}
.theme-button:hover::before,
.theme-button--open::before {
  transform: rotate(180deg);
}
.theme-button:active {
  transform: scale(0.94);
}
.theme-button:focus-visible {
  outline: 3px solid var(--color-base-content);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .theme-button,
  .theme-button::before {
    transition: none;
  }
  .theme-button:hover,
  .theme-button:active {
    transform: none;
  }
}
</style>
