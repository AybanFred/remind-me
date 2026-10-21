<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' or 'signup'
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.signInWithEmail(email.value, password.value)
    } else {
      await auth.signUpWithEmail(email.value, password.value)
    }
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="card card-border bg-base-100 w-full max-w-sm shadow-md">
      <div class="card-body gap-3">
        <h1 class="card-title text-2xl">{{ mode === 'login' ? 'Log in' : 'Sign up' }}</h1>

        <button class="btn btn-outline" @click="auth.signInWithGoogle()">Continue with Google</button>

        <div class="divider my-0">or</div>

        <form class="space-y-3" @submit.prevent="submit">
          <input v-model="email" type="email" placeholder="Email" required class="input w-full" />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            minlength="6"
            class="input w-full"
          />
          <p v-if="error" class="text-error text-sm">{{ error }}</p>
          <button type="submit" :disabled="loading" class="btn btn-primary w-full">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            {{ mode === 'login' ? 'Log in' : 'Create account' }}
          </button>
        </form>

        <button class="btn btn-link btn-sm" @click="mode = mode === 'login' ? 'signup' : 'login'">
          {{ mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in' }}
        </button>
      </div>
    </div>
  </div>
</template>
