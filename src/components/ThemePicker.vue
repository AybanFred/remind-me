<script setup>
import { ref } from 'vue'
import { themes, getSavedTheme, applyTheme } from '@/lib/theme'

const current = ref(getSavedTheme())

function change() {
  applyTheme(current.value)
}
</script>

<template>
  <select v-model="current" class="select select-sm w-32" aria-label="Theme" @change="change">
    <option value="">System</option>
    <option v-for="t in themes" :key="t" :value="t" class="capitalize">{{ t }}</option>
  </select>
</template>
