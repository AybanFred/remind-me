<script setup>
import { Sparkles } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast'

const toasts = useToastStore()

function runAction(toast) {
  toast.action.handler()
  toasts.dismiss(toast.id)
}
</script>

<template>
  <!-- Pinned to the top so it never covers the bottom tab bar on phones. -->
  <div
    class="toast toast-top toast-center z-[1100] w-full max-w-md"
    style="top: calc(env(safe-area-inset-top) + 0.5rem)"
    aria-live="polite"
  >
    <div
      v-for="t in toasts.toasts"
      :key="t.id"
      class="alert shadow-lg"
      :class="{
        'alert-success': t.type === 'success',
        'alert-error': t.type === 'error',
        'alert-info': t.type === 'info',
        'bg-primary text-primary-content border-primary': t.type === 'reward'
      }"
      role="status"
    >
      <Sparkles v-if="t.type === 'reward'" class="size-5 shrink-0" />
      <span class="text-sm" :class="{ 'font-semibold': t.type === 'reward' }">{{ t.message }}</span>
      <button v-if="t.action" class="btn btn-sm btn-ghost" @click="runAction(t)">
        {{ t.action.label }}
      </button>
    </div>
  </div>
</template>
