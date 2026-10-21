<script setup>
import { applyTheme, currentTheme, themeLabels, themes } from '@/lib/theme'
</script>

<template>
  <select
    :value="currentTheme"
    class="select select-sm w-full"
    aria-label="Theme"
    @change="applyTheme($event.target.value)"
  >
    <option value="">System</option>
    <option v-for="t in themes" :key="t" :value="t" class="capitalize">{{ themeLabels[t] ?? t }}</option>
  </select>
</template>
