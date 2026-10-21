<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Camera, PartyPopper, RotateCcw, Trash2 } from 'lucide-vue-next'
import { FONT_PRESETS, isValidFontName } from '@/lib/appearance'
import { cssColorToHex } from '@/lib/color'
import { celebrate } from '@/lib/confetti'
import { useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import ThemePicker from '@/components/ThemePicker.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CategoryManager from '@/components/CategoryManager.vue'
import { useTasksStore } from '@/stores/tasks'

const auth = useAuthStore()
const appearance = useAppearanceStore()
const toast = useToastStore()

// ---------- Profile ----------
const name = ref(auth.displayName)
const savingName = ref(false)
const uploading = ref(false)
const fileInput = ref(null)

async function saveName() {
  savingName.value = true
  try {
    await auth.updateMetadata({ full_name: name.value.trim() })
    toast.success('Name saved')
  } catch (e) {
    toast.error(`Could not save your name: ${e.message}`)
  } finally {
    savingName.value = false
  }
}

async function onPhotoChosen(event) {
  const file = event.target.files[0]
  event.target.value = '' // lets you pick the same file again later
  if (!file) return
  uploading.value = true
  try {
    await auth.uploadAvatar(file)
    toast.success('Profile photo updated')
  } catch (e) {
    toast.error(e.message)
  } finally {
    uploading.value = false
  }
}

async function removePhoto() {
  uploading.value = true
  try {
    await auth.removeAvatar()
    toast.success('Photo removed')
  } catch (e) {
    toast.error(`Could not remove the photo: ${e.message}`)
  } finally {
    uploading.value = false
  }
}

// ---------- Colours ----------
const colorFields = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links, highlights' },
  { key: 'secondary', label: 'Secondary', hint: 'Job hunt tasks, break timer' },
  { key: 'accent', label: 'Accent', hint: 'Daily tasks, streak flame' }
]

// <input type="color"> needs a hex value. When you have not picked a colour, we show the
// theme's own colour (read from the page) so the picker starts from what you currently see.
const themeColors = reactive({ primary: '#000000', secondary: '#000000', accent: '#000000' })

function readThemeColors() {
  const css = getComputedStyle(document.documentElement)
  for (const { key } of colorFields) {
    if (!appearance.prefs[key]) themeColors[key] = cssColorToHex(css.getPropertyValue(`--color-${key}`).trim())
  }
}

// Switching themes changes what "the theme's own colour" is.
let themeObserver
onMounted(() => {
  useTasksStore().fetchTasks() // the category list shows how many tasks each one has
  readThemeColors()
  themeObserver = new MutationObserver(readThemeColors)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
onBeforeUnmount(() => themeObserver?.disconnect())

async function resetColor(key) {
  appearance.set({ [key]: null })
  await nextTick()
  readThemeColors()
}

// ---------- Font ----------
const fontChoice = ref('') // '' = default, a preset name, or '__custom'
const customFont = ref('')

// Keep the dropdown in step with the saved setting (also when a font fails to load and is reset).
watch(
  () => appearance.prefs.font,
  (font) => {
    if (!font) fontChoice.value = ''
    else if (FONT_PRESETS.some((f) => f.name === font)) fontChoice.value = font
    else {
      fontChoice.value = '__custom'
      customFont.value = font
    }
  },
  { immediate: true }
)

function onFontChoice() {
  if (fontChoice.value === '__custom') return // wait until a name is typed and applied
  appearance.set({ font: fontChoice.value || null })
}

function applyCustomFont() {
  if (!isValidFontName(customFont.value)) {
    toast.error('Use the font name as shown on fonts.google.com, letters and numbers only.')
    return
  }
  appearance.set({ font: customFont.value.trim() })
}

// ---------- Celebrations ----------
function tryCelebration() {
  celebrate('medium')
  toast.show('Hat trick! 3 tasks done today.  +10 XP', { type: 'reward', duration: 4000 })
}

async function resetAll() {
  appearance.reset()
  await nextTick()
  readThemeColors()
  toast.success('Appearance reset to the theme defaults')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Profile -->
    <section class="card card-border bg-base-100 space-y-4 p-5">
      <h2 class="font-semibold">Profile</h2>

      <div class="flex items-center gap-4">
        <UserAvatar size="lg" />
        <div class="space-y-2">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onPhotoChosen"
          />
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary" :disabled="uploading" @click="fileInput.click()">
              <span v-if="uploading" class="loading loading-spinner loading-xs"></span>
              <Camera v-else class="size-4" />
              Upload photo
            </button>
            <button
              v-if="auth.meta.avatar_path"
              class="btn btn-sm btn-ghost"
              :disabled="uploading"
              @click="removePhoto"
            >
              <Trash2 class="size-4" /> Remove
            </button>
          </div>
          <p class="text-base-content/60 text-xs">
            Cropped to a square and shrunk before upload. JPG, PNG or WebP.
          </p>
        </div>
      </div>

      <form class="space-y-3" @submit.prevent="saveName">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">Display name</span>
          <input v-model="name" maxlength="60" class="input w-full" placeholder="Your name" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">Email</span>
          <input :value="auth.user?.email" disabled class="input w-full" />
        </label>
        <button class="btn btn-primary btn-sm" :disabled="savingName || !name.trim()">
          <span v-if="savingName" class="loading loading-spinner loading-xs"></span>
          Save name
        </button>
      </form>
    </section>

    <!-- Appearance -->
    <section class="card card-border bg-base-100 space-y-5 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">Appearance</h2>
        <button class="btn btn-ghost btn-sm" @click="resetAll">
          <RotateCcw class="size-4" /> Reset
        </button>
      </div>

      <label class="block text-sm">
        <span class="mb-1 block font-medium">Base theme</span>
        <ThemePicker />
      </label>

      <div class="space-y-3">
        <p class="text-sm font-medium">Brand colors</p>
        <div v-for="c in colorFields" :key="c.key" class="flex items-center gap-3">
          <input
            type="color"
            class="border-base-300 h-10 w-14 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
            :value="appearance.prefs[c.key] ?? themeColors[c.key]"
            :aria-label="`${c.label} color`"
            @input="appearance.set({ [c.key]: $event.target.value })"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ c.label }}</p>
            <p class="text-base-content/60 truncate text-xs">{{ c.hint }}</p>
          </div>
          <button
            v-if="appearance.prefs[c.key]"
            class="btn btn-ghost btn-xs"
            @click="resetColor(c.key)"
          >
            Use theme color
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium">Font</p>
        <select v-model="fontChoice" class="select w-full" aria-label="Font" @change="onFontChoice">
          <option value="">Default (Plus Jakarta Sans)</option>
          <option v-for="f in FONT_PRESETS" :key="f.name" :value="f.name">{{ f.name }}</option>
          <option value="__custom">Other Google font...</option>
        </select>

        <form v-if="fontChoice === '__custom'" class="flex gap-2" @submit.prevent="applyCustomFont">
          <input
            v-model="customFont"
            class="input w-full"
            placeholder="e.g. Quicksand, Rubik, Playfair Display"
            maxlength="40"
          />
          <button class="btn btn-primary" :disabled="appearance.fontStatus === 'loading'">Apply</button>
        </form>

        <p v-if="appearance.fontStatus === 'loading'" class="text-base-content/60 flex items-center gap-2 text-sm">
          <span class="loading loading-spinner loading-xs"></span> Loading font...
        </p>
        <p v-else-if="appearance.fontStatus === 'error'" class="text-error text-sm">
          {{ appearance.fontError }}
        </p>
        <p class="text-base-content/50 text-xs">
          Fonts other than the default are fetched from Google Fonts when you choose them.
        </p>
      </div>

      <!-- Live preview of the choices above -->
      <div class="bg-base-200 rounded-box space-y-3 p-4">
        <p class="text-lg font-bold">Preview</p>
        <p class="text-sm">The quick brown fox jumps over the lazy dog. 0123456789</p>
        <div class="flex flex-wrap gap-2">
          <span class="btn btn-primary btn-sm pointer-events-none">Primary</span>
          <span class="btn btn-secondary btn-sm pointer-events-none">Secondary</span>
          <span class="btn btn-accent btn-sm pointer-events-none">Accent</span>
        </div>
      </div>

      <p class="text-base-content/60 text-xs">
        Your choices are saved on this device and on your account, so they follow you to other devices.
      </p>
    </section>

    <CategoryManager />

    <!-- Celebrations -->
    <section class="card card-border bg-base-100 space-y-3 p-5">
      <h2 class="font-semibold">Celebrations</h2>
      <label class="flex cursor-pointer items-center justify-between gap-3">
        <span class="text-sm">
          <span class="block font-medium">Confetti when you finish a task</span>
          <span class="text-base-content/60 text-xs">
            Switched off automatically if your device is set to reduce motion.
          </span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          :checked="appearance.prefs.confetti"
          @change="appearance.set({ confetti: $event.target.checked })"
        />
      </label>
      <button class="btn btn-outline btn-sm" @click="tryCelebration">
        <PartyPopper class="size-4" /> Try it
      </button>
    </section>
  </div>
</template>
