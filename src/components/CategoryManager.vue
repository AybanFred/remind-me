<script setup>
import { computed, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { dotLook, THEME_COLORS } from '@/lib/categories'
import { isHexColor } from '@/lib/color'
import { useCategoriesStore } from '@/stores/categories'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import CategoryBadge from '@/components/CategoryBadge.vue'

const categories = useCategoriesStore()
const tasks = useTasksStore()
const toast = useToastStore()

// How many tasks use each category, so deleting can say what will happen to them.
const usage = computed(() => {
  const counts = new Map()
  for (const t of tasks.tasks) counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
  return counts
})

// ---------- Add ----------
// Theme colours follow the selected theme; "Custom" lets you pick any fixed colour.
const newLabel = ref('')
const newColor = ref('info')
const newCustom = ref('#0ea5e9')
const adding = ref(false)

async function add() {
  if (!newLabel.value.trim()) return
  adding.value = true
  try {
    await categories.add({
      label: newLabel.value,
      color: newColor.value === 'custom' ? newCustom.value : newColor.value
    })
    toast.success('Category added')
    newLabel.value = ''
  } catch (e) {
    toast.error(`Could not add the category: ${e.message}`)
  } finally {
    adding.value = false
  }
}

// ---------- Edit ----------
const editingId = ref(null)
const editLabel = ref('')
const editColor = ref('primary')
const editCustom = ref('#0ea5e9')

function startEdit(c) {
  editingId.value = c.id
  editLabel.value = c.label
  const custom = isHexColor(c.color)
  editColor.value = custom ? 'custom' : c.color
  editCustom.value = custom ? c.color : '#0ea5e9'
}

async function saveEdit(c) {
  if (!editLabel.value.trim()) return
  try {
    await categories.update(c.id, {
      label: editLabel.value.trim(),
      color: editColor.value === 'custom' ? editCustom.value : editColor.value
    })
    editingId.value = null
    toast.success('Category saved')
  } catch (e) {
    toast.error(`Could not save the category: ${e.message}`)
  }
}

// ---------- Delete ----------
// Deleting asks where its tasks should go (if it has any), so no task is ever left without a category.
const deletingId = ref(null)
const moveTo = ref('')

function startDelete(c) {
  deletingId.value = c.id
  moveTo.value = categories.all.find((other) => other.key !== c.key)?.key ?? ''
}

async function confirmDelete(c) {
  try {
    await categories.remove(c, usage.value.get(c.key) ? moveTo.value : null)
    deletingId.value = null
    toast.success('Category removed')
  } catch (e) {
    toast.error(`Could not remove the category: ${e.message}`)
  }
}
</script>

<template>
  <section id="categories" class="card card-border bg-base-100 scroll-mt-20 space-y-4 p-5">
    <div>
      <h2 class="font-semibold">Task categories</h2>
      <p class="text-base-content/60 text-sm">Rename, recolor, add or remove the categories you sort tasks into.</p>
    </div>

    <p v-if="!categories.ready" class="alert alert-warning alert-soft text-sm">
      Custom categories are not set up yet. Run
      <code>supabase/migrations/20261025000000_categories.sql</code> in Supabase, then refresh.
    </p>

    <template v-else>
      <ul class="space-y-2">
        <li v-for="c in categories.all" :key="c.key" class="bg-base-200 rounded-lg p-3">
          <!-- Editing -->
          <form v-if="editingId === c.id" class="space-y-2" @submit.prevent="saveEdit(c)">
            <input v-model="editLabel" maxlength="40" required class="input input-sm w-full" aria-label="Name" />
            <div class="flex flex-wrap items-center gap-2">
              <select v-model="editColor" class="select select-sm w-auto" aria-label="Color">
                <option v-for="t in THEME_COLORS" :key="t" :value="t" class="capitalize">{{ t }} (theme)</option>
                <option value="custom">Custom color</option>
              </select>
              <input
                v-if="editColor === 'custom'"
                v-model="editCustom"
                type="color"
                class="border-base-300 h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                aria-label="Custom color"
              />
              <button class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="editingId = null">Cancel</button>
            </div>
          </form>

          <!-- Confirming a delete -->
          <div v-else-if="deletingId === c.id" class="space-y-2 text-sm">
            <p>
              Remove <strong>{{ c.label }}</strong>?
              <template v-if="usage.get(c.key)">
                Its {{ usage.get(c.key) }} {{ usage.get(c.key) === 1 ? 'task' : 'tasks' }} will move to:
              </template>
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <select v-if="usage.get(c.key)" v-model="moveTo" class="select select-sm w-auto" aria-label="Move tasks to">
                <option v-for="o in categories.all.filter((x) => x.key !== c.key)" :key="o.key" :value="o.key">
                  {{ o.label }}
                </option>
              </select>
              <button class="btn btn-error btn-sm" @click="confirmDelete(c)">Remove</button>
              <button class="btn btn-ghost btn-sm" @click="deletingId = null">Cancel</button>
            </div>
          </div>

          <!-- Normal -->
          <div v-else class="flex items-center gap-3">
            <CategoryBadge :category="c.key" />
            <span class="text-base-content/60 flex-1 text-xs">
              {{ usage.get(c.key) ?? 0 }} {{ usage.get(c.key) === 1 ? 'task' : 'tasks' }}
            </span>
            <button class="btn btn-ghost btn-square btn-sm" :aria-label="`Edit ${c.label}`" @click="startEdit(c)">
              <Pencil class="size-4" />
            </button>
            <button
              class="btn btn-ghost btn-square btn-sm text-error"
              :aria-label="`Remove ${c.label}`"
              :disabled="categories.all.length <= 1"
              :title="categories.all.length <= 1 ? 'Keep at least one category' : ''"
              @click="startDelete(c)"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
        </li>
      </ul>

      <!-- Add -->
      <form class="flex flex-wrap items-center gap-2" @submit.prevent="add">
        <input
          v-model="newLabel"
          maxlength="40"
          placeholder="New category, e.g. Side projects"
          class="input input-sm min-w-40 flex-1"
        />
        <span class="size-3 rounded-full" v-bind="dotLook(newColor === 'custom' ? newCustom : newColor)"></span>
        <select v-model="newColor" class="select select-sm w-auto" aria-label="Color">
          <option v-for="t in THEME_COLORS" :key="t" :value="t" class="capitalize">{{ t }} (theme)</option>
          <option value="custom">Custom color</option>
        </select>
        <input
          v-if="newColor === 'custom'"
          v-model="newCustom"
          type="color"
          class="border-base-300 h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5"
          aria-label="Custom color"
        />
        <button class="btn btn-primary btn-sm" :disabled="adding || !newLabel.trim()">
          <Plus class="size-4" /> Add
        </button>
      </form>
      <p class="text-base-content/50 text-xs">
        Removing a category that is in use asks where its tasks should go first.
      </p>
    </template>
  </section>
</template>
