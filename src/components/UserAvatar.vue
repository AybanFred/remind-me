<script setup>
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

// The user's photo, or their initials on a coloured circle when there is no photo.
const props = defineProps({
  size: { type: String, default: 'sm' } // 'sm' | 'md' | 'lg'
})

const auth = useAuthStore()
const failed = ref(false)

// If the picture can't load (offline, deleted file), show the initials instead of a broken image.
watch(() => auth.avatarUrl, () => (failed.value = false))

const showPhoto = computed(() => auth.avatarUrl && !failed.value)

const initials = computed(() => {
  const words = auth.displayName.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
})

const sizes = { sm: 'size-9 text-sm', md: 'size-12 text-base', lg: 'size-24 text-3xl' }
</script>

<template>
  <div class="avatar" :class="{ 'avatar-placeholder': !showPhoto }">
    <div
      class="rounded-full"
      :class="[sizes[props.size], showPhoto ? '' : 'bg-primary text-primary-content']"
    >
      <!-- no-referrer: Google's picture servers refuse to serve images to some referrers -->
      <img
        v-if="showPhoto"
        :src="auth.avatarUrl"
        alt=""
        referrerpolicy="no-referrer"
        @error="failed = true"
      />
      <span v-else class="font-semibold">{{ initials }}</span>
    </div>
  </div>
</template>
