<script setup>
import { computed, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useCategoriesStore } from '@/stores/categories'
import { isoToLocalInput, localInputToIso } from '@/lib/dates'
import DueDatePicker from '@/components/DueDatePicker.vue'
import ImportantToggle from '@/components/ImportantToggle.vue'

// Used for BOTH adding a new task and editing an existing one.
// For editing, the parent passes the task in as `initial`.
// `onSave` is a function the parent gives us (an async call to the store). We take it
// as a prop instead of an event so we can `await` it and show any error in the form.
const props = defineProps({
  onSave: { type: Function, required: true },
  initial: { type: Object, default: null },
  submitLabel: { type: String, default: 'Add task' }
})
const emit = defineEmits(['cancel'])

const titleInput = ref(null)
const title = ref(props.initial?.title ?? '')
const notes = ref(props.initial?.notes ?? '')
const categories = useCategoriesStore()
const category = ref(props.initial?.category ?? categories.all[0]?.key ?? 'daily')

// If the task's own category was removed, still offer it so editing doesn't silently change it.
const categoryOptions = computed(() => {
  const list = categories.all.map((c) => ({ key: c.key, label: c.label }))
  if (category.value && !categories.byKey.has(category.value)) {
    list.push({ key: category.value, label: categories.labelOf(category.value) })
  }
  return list
})
const dueAt = ref(isoToLocalInput(props.initial?.due_at))
const important = ref(props.initial?.important ?? false)
const error = ref('')
const saving = ref(false)

// Lets the page focus the title box (used by the "N" keyboard shortcut).
defineExpose({ focus: () => titleInput.value?.focus() })

async function onSubmit() {
  error.value = ''
  saving.value = true
  try {
    const task = {
      title: title.value.trim(),
      notes: notes.value.trim(),
      category: category.value,
      due_at: localInputToIso(dueAt.value)
    }
    // Only sent when it changed, so saving still works before the `important` column exists.
    if (important.value !== (props.initial?.important ?? false)) task.important = important.value
    await props.onSave(task)
    if (!props.initial) {
      title.value = ''
      notes.value = ''
      dueAt.value = ''
      important.value = false
      titleInput.value?.focus() // ready for the next task
    }
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card card-border bg-base-100 space-y-3 p-4" @submit.prevent="onSubmit">
    <input
      ref="titleInput"
      v-model="title"
      required
      placeholder="What needs doing?"
      class="input input-lg w-full font-medium"
    />
    <textarea
      v-model="notes"
      rows="2"
      placeholder="Notes (optional)"
      class="textarea w-full"
    />
    <div class="grid gap-3 sm:grid-cols-2">
      <select v-model="category" class="select w-full" aria-label="Category">
        <option v-for="c in categoryOptions" :key="c.key" :value="c.key">{{ c.label }}</option>
      </select>
      <DueDatePicker v-model="dueAt" />
    </div>
    <p v-if="error" class="text-error text-sm">{{ error }}</p>
    <div class="flex flex-wrap gap-2">
      <button type="submit" :disabled="saving" class="btn btn-primary">
        <span v-if="saving" class="loading loading-spinner loading-sm"></span>
        <Plus v-else-if="!initial" class="size-4" />
        {{ submitLabel }}
      </button>
      <button v-if="initial" type="button" class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
      <ImportantToggle v-model="important" class="ml-auto" />
    </div>
  </form>
</template>
