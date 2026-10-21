<script setup>
import { computed } from 'vue'
import { badgeLook } from '@/lib/categories'
import { useCategoriesStore } from '@/stores/categories'

// Shows a task's category in that category's colour. `category` is the key stored on the task.
const props = defineProps({
  category: { type: String, default: '' },
  small: { type: Boolean, default: false }
})

const categories = useCategoriesStore()

const look = computed(() => badgeLook(categories.byKey.get(props.category)?.color ?? 'neutral'))
</script>

<template>
  <span class="badge" :class="[look.class, { 'badge-sm': small }]" :style="look.style">
    {{ categories.labelOf(category) }}
  </span>
</template>
