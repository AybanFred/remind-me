<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppFooter from '@/components/AppFooter.vue'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' or 'signup'
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const awaitingConfirmation = ref(false) // the account exists but its email is not confirmed yet
const resent = ref(false)

async function submit() {
  error.value = ''
  awaitingConfirmation.value = false
  resent.value = false
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.signInWithEmail(email.value, password.value)
    } else if (await auth.signUpWithEmail(email.value, password.value)) {
      // The account must be confirmed from the email first, so there is nobody to log in yet.
      awaitingConfirmation.value = true
      return
    }
    router.push('/')
  } catch (e) {
    if (/not confirmed/i.test(e.message)) {
      error.value = 'Please confirm your email first. Open the link we sent you, then log in.'
      awaitingConfirmation.value = true
    } else {
      error.value = e.message
    }
  } finally {
    loading.value = false
  }
}

async function resend() {
  error.value = ''
  loading.value = true
  try {
    await auth.resendConfirmation(email.value)
    resent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function backToLogin() {
  mode.value = 'login'
  awaitingConfirmation.value = false
  resent.value = false
  error.value = ''
  password.value = ''
}
</script>

<template>
  <div
    class="from-primary/15 via-base-100 to-secondary/15 flex min-h-screen flex-col items-center justify-center bg-linear-to-br p-4"
  >
    <div class="card card-border bg-base-100 w-full max-w-sm shadow-md">
      <div class="card-body gap-3">
        <div class="mb-2 flex flex-col items-center gap-2 text-center">
          <img src="/icon.svg" alt="" class="size-16" />
          <h1 class="text-2xl font-bold">Remind Me</h1>
          <p class="text-base-content/60 text-sm">
            {{
              mode === 'login'
                ? 'Welcome back. Pick up where you left off.'
                : 'Create an account to start planning.'
            }}
          </p>
        </div>

        <!-- After sign-up the email must be confirmed before anyone can log in. -->
        <div
          v-if="awaitingConfirmation && mode === 'signup'"
          class="space-y-3 text-center"
          role="status"
        >
          <p class="text-lg font-semibold">Check your email</p>
          <p class="text-base-content/70 text-sm">
            We sent a confirmation link to <strong class="break-all">{{ email }}</strong
            >. Open it to activate your account, then log in. It can take a minute and may land in
            spam.
          </p>
          <p v-if="resent" class="text-success text-sm">Sent again. Please check your inbox.</p>
          <p v-if="error" class="text-error text-sm">{{ error }}</p>
          <button class="btn btn-outline btn-sm" :disabled="loading" @click="resend">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            Resend the email
          </button>
          <button class="btn btn-primary w-full" @click="backToLogin">Back to log in</button>
        </div>

        <template v-else>
          <button class="btn btn-outline" @click="auth.signInWithGoogle()">
            Continue with Google
          </button>

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
            <button
              v-if="awaitingConfirmation && mode === 'login'"
              type="button"
              class="btn btn-outline btn-sm w-full"
              :disabled="loading"
              @click="resend"
            >
              Resend the confirmation email
            </button>
            <p v-if="resent && mode === 'login'" class="text-success text-sm">
              Sent again. Please check your inbox.
            </p>
            <button type="submit" :disabled="loading" class="btn btn-primary w-full">
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              {{ mode === 'login' ? 'Log in' : 'Create account' }}
            </button>
          </form>

          <button class="btn btn-link btn-sm" @click="mode = mode === 'login' ? 'signup' : 'login'">
            {{ mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in' }}
          </button>
        </template>
      </div>
    </div>
    <AppFooter />
  </div>
</template>
