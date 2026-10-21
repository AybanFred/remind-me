<script setup>
import { ref } from 'vue'
import { isoToLocalInput, localInputToIso } from '@/lib/dates'

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

const title = ref(props.initial?.title ?? '')
const notes = ref(props.initial?.notes ?? '')
const category = ref(props.initial?.category ?? 'daily')
const dueAt = ref(isoToLocalInput(props.initial?.due_at))
const error = ref('')
const saving = ref(false)

async function onSubmit() {
  error.value = ''
  saving.value = true
  try {
    await props.onSave({
      title: title.value.trim(),
      notes: notes.value.trim(),
      category: category.value,
      due_at: localInputToIso(dueAt.value)
    })
    if (!props.initial) {
      title.value = ''
      notes.value = ''
      dueAt.value = ''
    }
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card card-border bg-base-100 space-y-3 p-4 shadow-sm" @submit.prevent="onSubmit">
    <input
      v-model="title"
      required
      placeholder="What needs doing?"
      class="input w-full"
    />
    <textarea
      v-model="notes"
      rows="2"
      placeholder="Notes (optional)"
      class="textarea w-full"
    />
    <div class="flex flex-wrap gap-3">
      <select v-model="category" class="select w-auto">
        <option value="upskilling">Upskilling</option>
        <option value="job_hunt">Job hunt</option>
        <option value="daily">Daily</option>
      </select>
      <input
        v-model="dueAt"
        type="datetime-local"
        class="input w-auto"
      />
    </div>
    <p v-if="error" class="text-error text-sm">{{ error }}</p>
    <div class="flex gap-2">
      <button
        type="submit"
        :disabled="saving"
        class="btn btn-primary"
      >
        {{ submitLabel }}
      </button>
      <button
        v-if="initial"
        type="button"
        class="btn btn-ghost"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
