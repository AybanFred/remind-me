import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true
  }),
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      this.user = data.session?.user ?? null
      this.loading = false

      supabase.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user ?? null
      })
    },
    async signUpWithEmail(email, password) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    },
    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
      this.user = null
    }
  }
})