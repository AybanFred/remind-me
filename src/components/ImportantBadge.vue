<script setup>
import { Flame } from 'lucide-vue-next'

// The red "Very important" tag shown on a task.
defineProps({ small: { type: Boolean, default: false } })
</script>

<template>
  <span class="badge badge-error gap-1 font-semibold" :class="{ 'badge-sm': small }">
    <Flame class="size-3" /> Very important
  </span>
</template>
