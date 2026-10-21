import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CATEGORIES, labelFromKey, slugify } from '@/lib/categories'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'

const byPosition = (a, b) => a.position - b.position

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    list: [],
    // Turns false if the categories table has not been created yet. The app then keeps using
    // the three built-in categories and hides the editing controls.
    ready: true
  }),

  getters: {
    // What every screen should show. Until the user's own list has loaded, use the defaults.
    all: (state) => (state.list.length ? [...state.list].sort(byPosition) : DEFAULT_CATEGORIES),
    byKey() {
      return new Map(this.all.map((c) => [c.key, c]))
    },
    keys() {
      return this.all.map((c) => c.key)
    },
    // Works for any key, including one whose category has been removed.
    labelOf() {
      return (key) => this.byKey.get(key)?.label ?? labelFromKey(key)
    }
  },

  actions: {
    async fetch() {
      const { data, error } = await supabase.from('categories').select('*').order('position')
      if (error) {
        if (/categories|schema cache|does not exist/i.test(error.message)) this.ready = false
        return
      }
      this.ready = true

      if (data.length) {
        this.list = data
        return
      }

      // First visit: give the user the three starting categories. "ignoreDuplicates" makes this
      // harmless if another device does the same thing at the same moment.
      const auth = useAuthStore()
      const { data: seeded, error: seedError } = await supabase
        .from('categories')
        .upsert(
          DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: auth.user.id })),
          { onConflict: 'user_id,key', ignoreDuplicates: true }
        )
        .select()
      if (!seedError && seeded.length) this.list = seeded
      else if (!seedError) await this.fetch() // the other device won the race; just load its rows
    },

    async add({ label, color }) {
      const auth = useAuthStore()
      const position = this.list.reduce((max, c) => Math.max(max, c.position), -1) + 1
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: auth.user.id, key: slugify(label, this.keys), label: label.trim(), color, position })
        .select()
        .single()
      if (error) throw error
      this.list.push(data)
      return data
    },

    // Only the label and colour change. The key stays the same, so no task needs updating.
    async update(id, changes) {
      const { data, error } = await supabase.from('categories').update(changes).eq('id', id).select().single()
      if (error) throw error
      this.list[this.list.findIndex((c) => c.id === id)] = data
    },

    // Removes a category. Its tasks are first moved to `moveToKey`, so no task is left without one.
    async remove(category, moveToKey) {
      if (this.list.length <= 1) throw new Error('Keep at least one category.')
      const tasks = useTasksStore()

      if (moveToKey) {
        const { error } = await supabase.from('tasks').update({ category: moveToKey }).eq('category', category.key)
        if (error) throw error
        tasks.tasks.forEach((t) => {
          if (t.category === category.key) t.category = moveToKey
        })
        if (tasks.filter === category.key) tasks.filter = 'all'
      }

      const { error } = await supabase.from('categories').delete().eq('id', category.id)
      if (error) throw error
      this.list = this.list.filter((c) => c.id !== category.id)
    },

    clear() {
      this.$reset()
    }
  }
})
