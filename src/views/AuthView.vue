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
  <div class="auth-box">
    <h1>{{ mode === 'login' ? 'Log in' : 'Sign up' }}</h1>

    <button @click="auth.signInWithGoogle()">Continue with Google</button>

    <form @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" required />
      <input v-model="password" type="password" placeholder="Password" required minlength="6" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ mode === 'login' ? 'Log in' : 'Create account' }}
      </button>
    </form>

    <button @click="mode = mode === 'login' ? 'signup' : 'login'">
      {{ mode === 'login' ? "No account? Sign up" : "Have an account? Log in" }}
    </button>
  </div>
</template>