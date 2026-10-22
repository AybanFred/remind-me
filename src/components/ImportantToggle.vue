<script setup>
import { Flame } from 'lucide-vue-next'

// A button that switches a task's "Very important" tag on or off. Used with v-model.
const important = defineModel({ type: Boolean, default: false })
defineProps({ small: { type: Boolean, default: false } })
</script>

<template>
  <button
    type="button"
    class="btn gap-1.5"
    :class="[important ? 'btn-error' : 'btn-ghost border-base-300', { 'btn-sm': small }]"
    :aria-pressed="important"
    @click="important = !important"
  >
    <Flame class="size-4" :class="{ 'fill-current': important }" />
    Very important
  </button>
</template>
