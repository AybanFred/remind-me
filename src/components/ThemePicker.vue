<script setup>
import { ref } from 'vue'
import { themes, getSavedTheme, applyTheme } from '@/lib/theme'

const current = ref(getSavedTheme())

// Friendly names for the dropdown (the rest are just capitalised).
const labels = { remind: 'Remind Me (light)', 'remind-dark': 'Remind Me (dark)' }

function change() {
  applyTheme(current.value)
}
</script>

<template>
  <select v-model="current" class="select select-sm w-full" aria-label="Theme" @change="change">
    <option value="">System</option>
    <option v-for="t in themes" :key="t" :value="t" class="capitalize">{{ labels[t] ?? t }}</option>
  </select>
</template>
