<script setup>
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useTimeStore } from '@/stores/time'
import { useToastStore } from '@/stores/toast'
import ProjectCard from '@/components/ProjectCard.vue'

const time = useTimeStore()
const toast = useToastStore()

onMounted(() => time.fetchAll())

// A handful of pleasant colours; each new project gets the next one so they start out different.
const palette = ['#4f46e5', '#0d9488', '#ea580c', '#db2777', '#2563eb', '#65a30d', '#9333ea', '#ca8a04']
const currencies = ['USD', 'EUR', 'GBP', 'PHP', 'AUD', 'CAD', 'SGD', 'INR', 'JPY']

const form = ref({ name: '', client: '', color: palette[time.projects.length % palette.length], hourlyRate: '' })
const saving = ref(false)
const showArchived = ref(false)

const active = computed(() => time.projects.filter((p) => !p.archived))
const archived = computed(() => time.projects.filter((p) => p.archived))

async function addProject() {
  saving.value = true
  try {
    await time.addProject(form.value)
    toast.success('Project created')
    form.value = {
      name: '',
      client: '',
      color: palette[time.projects.length % palette.length],
      hourlyRate: ''
    }
  } catch (e) {
    toast.error(`Could not create the project: ${e.message}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <form class="card card-border bg-base-100 space-y-3 p-4" @submit.prevent="addProject">
      <h2 class="font-semibold">New project</h2>
      <div class="flex gap-2">
        <input
          v-model="form.color"
          type="color"
          class="border-base-300 h-12 w-14 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
          aria-label="Project color"
        />
        <input v-model="form.name" required maxlength="80" placeholder="Project name" class="input input-lg w-full" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="form.client" maxlength="80" placeholder="Client (optional)" class="input w-full" />
        <input
          v-model="form.hourlyRate"
          type="number"
          min="0"
          step="0.01"
          placeholder="Hourly rate (optional)"
          class="input w-full"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button class="btn btn-primary" :disabled="saving">
          <span v-if="saving" class="loading loading-spinner loading-sm"></span>
          <Plus v-else class="size-4" />
          Add project
        </button>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-base-content/60">Currency</span>
          <select
            class="select select-sm w-24"
            :value="time.currency"
            aria-label="Currency"
            @change="time.setCurrency($event.target.value)"
          >
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>
    </form>

    <p v-if="time.error" class="alert alert-error alert-soft">{{ time.error }}</p>

    <div v-if="time.loading && !time.projects.length" class="space-y-3">
      <div v-for="n in 2" :key="n" class="skeleton h-32 w-full"></div>
    </div>

    <p v-else-if="!time.projects.length && !time.error" class="text-base-content/60 py-6 text-center text-sm">
      No projects yet. Create one above, add its tasks, then track time against it.
    </p>

    <ProjectCard v-for="p in active" :key="p.id" :project="p" />

    <section v-if="archived.length" class="space-y-3">
      <button class="btn btn-ghost btn-sm" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} archived ({{ archived.length }})
      </button>
      <template v-if="showArchived">
        <ProjectCard v-for="p in archived" :key="p.id" :project="p" />
      </template>
    </section>
  </div>
</template>
