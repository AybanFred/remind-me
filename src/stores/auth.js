import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { toSquareJpeg } from '@/lib/avatar'
import { shouldSendWelcome } from '@/lib/welcome'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true
  }),

  getters: {
    // Google sign-in fills these in automatically; users who sign up with email can set their own.
    meta: (state) => state.user?.user_metadata ?? {},
    displayName() {
      return this.meta.full_name || this.meta.name || this.user?.email?.split('@')[0] || ''
    },
    avatarUrl() {
      return this.meta.avatar_url || this.meta.picture || ''
    }
  },

  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      this.user = data.session?.user ?? null
      this.loading = false

      supabase.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user ?? null
      })
    },
    // When the project requires email confirmation, Supabase creates the account but sends no
    // session back until the link in the email is opened. Returns true in that case, so the page
    // can tell the user to check their inbox.
    async signUpWithEmail(email, password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin } // the email link brings them back here
      })
      if (error) throw error
      return !data.session
    },
    async resendConfirmation(email) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin }
      })
      if (error) throw error
    },
    // Asks the "welcome" Edge Function to email a newly created account (once). The server decides
    // whether it is allowed, and a failure here must never get in the way of using the app.
    async sendWelcome() {
      if (!shouldSendWelcome(this.user)) return
      const { error } = await supabase.functions.invoke('welcome')
      if (error) console.warn('[welcome] could not send the welcome email:', error.message)
    },
    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          // Logging out only ends our session, not the user's Google one. Without this, Google
          // signs them straight back in; with it, they pick the account each time.
          queryParams: { prompt: 'select_account' }
        }
      })
      if (error) throw error
    },

    // Saves extra info about the user (display name, photo, appearance) on their account.
    // New keys are merged with what is already there.
    async updateMetadata(data) {
      const { error } = await supabase.auth.updateUser({ data })
      if (error) throw error
    },

    async uploadAvatar(file) {
      const blob = await toSquareJpeg(file)
      // Each user may only write inside their own folder (the storage policy checks this).
      const path = `${this.user.id}/${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) {
        throw new Error(
          /bucket not found/i.test(error.message)
            ? 'Photo storage is not set up yet. Run the avatars migration in Supabase (see the README).'
            : error.message
        )
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const previousPath = this.meta.avatar_path
      await this.updateMetadata({ avatar_url: data.publicUrl, avatar_path: path })
      if (previousPath) await supabase.storage.from('avatars').remove([previousPath]) // tidy up the old photo
    },

    async removeAvatar() {
      const previousPath = this.meta.avatar_path
      // Clearing avatar_url lets a Google profile picture (stored separately) show again.
      await this.updateMetadata({ avatar_url: null, avatar_path: null })
      if (previousPath) await supabase.storage.from('avatars').remove([previousPath])
    },

    async signOut() {
      await supabase.auth.signOut()
      this.user = null
    }
  }
})
