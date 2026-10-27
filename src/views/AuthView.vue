<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Eye, EyeOff, Flame, Trophy } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import AppFooter from '@/components/AppFooter.vue'
import coverImage from '@/assets/auth-cover.png'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' or 'signup'
const email = ref('')
const password = ref('')
const showPassword = ref(false)
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

// ---------- The floating scene (desktop only) ----------
// The little focus timer counts down from 25:00 and starts over, just for show.
const FOCUS_SECONDS = 25 * 60
const left = ref(18 * 60 + 24)
const elapsed = computed(() => 1 - left.value / FOCUS_SECONDS)
const clock = computed(() => {
  const m = String(Math.floor(left.value / 60)).padStart(2, '0')
  const s = String(left.value % 60).padStart(2, '0')
  return `${m}:${s}`
})
const demoDone = ref(false)
let tick = null
onMounted(() => {
  tick = setInterval(() => (left.value = left.value > 1 ? left.value - 1 : FOCUS_SECONDS), 1000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <!-- Desktop: one colourful scene. The cover and small app cards float gently, and the form
       floats over them as a glass card. Phones: just the form. -->
  <div
    class="from-primary/15 via-base-100 to-secondary/15 relative isolate min-h-screen overflow-hidden bg-linear-to-br lg:bg-[linear-gradient(150deg,#3730a3_0%,#4f46e5_45%,#7c3aed_100%)]"
  >
    <div class="pointer-events-none absolute inset-0 -z-10 hidden lg:block" aria-hidden="true">
      <div
        class="absolute -top-32 -left-32 size-136 rounded-full bg-[#2dd4bf] opacity-40 blur-[90px]"
      ></div>
      <div
        class="absolute top-1/3 -right-40 size-120 rounded-full bg-[#f59e42] opacity-30 blur-[90px]"
      ></div>
      <div
        class="absolute -bottom-48 left-1/4 size-144 rounded-full bg-[#ec4899] opacity-30 blur-[100px]"
      ></div>
      <div class="dots absolute inset-0"></div>
    </div>

    <!-- The floating picture and its cards. Decorative, so hidden from screen readers. -->
    <div class="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
      <div
        class="pointer-events-auto absolute top-1/2 left-[3vw] aspect-square h-[min(86vh,56vw)] -translate-y-1/2 xl:left-[4vw]"
      >
        <div class="bob size-full" style="--t: 9s">
          <img
            :src="coverImage"
            alt=""
            loading="lazy"
            draggable="false"
            class="size-full rounded-4xl shadow-2xl shadow-indigo-950/50 ring-1 ring-white/30 select-none"
          />
        </div>

        <!-- Streak -->
        <div class="absolute top-[3%] -right-10">
          <div
            class="bob flex items-center gap-3 rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 px-4 py-3 text-white shadow-xl shadow-orange-950/30 transition-transform hover:scale-105"
            style="--t: 6.5s; --delay: -1s"
          >
            <Flame class="size-8" />
            <div>
              <p class="text-3xl leading-none font-extrabold">5</p>
              <p class="text-xs font-semibold opacity-90">days in a row</p>
            </div>
          </div>
        </div>

        <!-- Level -->
        <div class="absolute top-[13%] -left-8">
          <div
            class="bob w-52 rounded-2xl bg-linear-to-br from-violet-500 to-violet-700 px-4 py-3 text-white shadow-xl shadow-violet-950/40 transition-transform hover:scale-105"
            style="--t: 7.5s; --delay: -3s"
          >
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold">Level 3</p>
              <Trophy class="size-4" />
            </div>
            <p class="text-2xl leading-tight font-extrabold">340 XP</p>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/30">
              <div class="h-full w-2/5 rounded-full bg-white"></div>
            </div>
          </div>
        </div>

        <!-- A focus timer that really ticks -->
        <div class="absolute bottom-[2%] -left-10">
          <div
            class="bob flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#1f1b3a] shadow-xl shadow-indigo-950/40 transition-transform hover:scale-105"
            style="--t: 8s; --delay: -5s"
          >
            <svg viewBox="0 0 48 48" class="size-12 -rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#e4e4f4" stroke-width="5" />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#4f46e5"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray="125.66"
                :stroke-dashoffset="125.66 * (1 - elapsed)"
              />
            </svg>
            <div>
              <p class="text-2xl leading-none font-extrabold tabular-nums">{{ clock }}</p>
              <p class="mt-0.5 text-xs font-semibold text-[#6b6b88]">Focus session</p>
            </div>
          </div>
        </div>

        <!-- A task you can tick off -->
        <div class="absolute -right-14 bottom-[2%]">
          <div
            class="bob w-64 cursor-pointer rounded-2xl bg-white p-3.5 text-[#1f1b3a] shadow-xl shadow-indigo-950/40 transition-transform select-none hover:scale-105"
            style="--t: 7s; --delay: -2s"
            @click="demoDone = !demoDone"
          >
            <div class="flex items-start gap-2.5">
              <span
                class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#4f46e5] transition-colors"
                :class="demoDone ? 'bg-[#4f46e5]' : ''"
              >
                <Check v-if="demoDone" class="size-3 text-white" :stroke-width="3.5" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-bold" :class="{ 'line-through opacity-50': demoDone }">
                  Apply to Brightwave Co.
                </p>
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold">
                  <span class="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700">Job hunt</span>
                  <span class="text-[#6b6b88]">Today, 6:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <main class="relative z-10 flex min-h-screen flex-col">
      <div
        class="flex flex-1 items-center justify-center p-4 sm:p-8 lg:justify-end lg:pr-[4vw] xl:pr-[7vw] 2xl:pr-[13vw]"
      >
        <div
          class="card card-border bg-base-100 w-full max-w-md shadow-md lg:rounded-3xl lg:border-white/40 lg:bg-base-100/85 lg:shadow-2xl lg:shadow-indigo-950/40 lg:backdrop-blur-xl"
        >
          <div class="card-body gap-4 p-6 sm:p-8">
            <div class="flex flex-col gap-1">
              <!-- The picture isn't shown on phones, so the logo and name come back here. -->
              <div class="mb-3 flex items-center gap-3 lg:hidden">
                <img src="/icon.svg" alt="" class="size-12" />
                <span class="text-2xl font-extrabold tracking-tight">Remind Me</span>
              </div>
              <h1 class="text-3xl font-bold tracking-tight">
                {{ mode === 'login' ? 'Welcome back' : 'Create your account' }}
              </h1>
              <p class="text-base-content/60">
                {{
                  mode === 'login'
                    ? 'Log in to pick up where you left off.'
                    : 'Sign up to start planning your tasks and focus time.'
                }}
              </p>
            </div>

            <!-- After sign-up the email must be confirmed before anyone can log in. -->
            <div
              v-if="awaitingConfirmation && mode === 'signup'"
              class="space-y-3 py-2"
              role="status"
            >
              <p class="text-lg font-semibold">Check your email</p>
              <p class="text-base-content/70 text-sm">
                We sent a confirmation link to <strong class="break-all">{{ email }}</strong
                >. Open it to activate your account, then log in. It can take a minute and may land
                in spam.
              </p>
              <p v-if="resent" class="text-success text-sm">Sent again. Please check your inbox.</p>
              <p v-if="error" class="text-error text-sm">{{ error }}</p>
              <button class="btn btn-outline btn-sm" :disabled="loading" @click="resend">
                <span v-if="loading" class="loading loading-spinner loading-sm"></span>
                Resend the email
              </button>
              <button class="btn btn-primary btn-lg w-full" @click="backToLogin">
                Back to log in
              </button>
            </div>

            <template v-else>
              <button type="button" class="btn btn-outline btn-lg" @click="auth.signInWithGoogle()">
                <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.83 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.17a11 11 0 0 0 0 9.86l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.17 7.07l3.66 2.84C6.7 7.32 9.13 5.38 12 5.38z"
                  />
                </svg>
                Continue with Google
              </button>

              <div class="divider my-0 text-sm">or with email</div>

              <form class="space-y-4" @submit.prevent="submit">
                <label class="block space-y-1.5">
                  <span class="text-sm font-medium">Email</span>
                  <input
                    v-model="email"
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                    class="input input-lg w-full"
                  />
                </label>
                <label class="block space-y-1.5">
                  <span class="text-sm font-medium">Password</span>
                  <span class="input input-lg flex w-full items-center gap-2 pe-2">
                    <input
                      v-model="password"
                      :type="showPassword ? 'text' : 'password'"
                      :placeholder="mode === 'signup' ? 'At least 6 characters' : 'Your password'"
                      :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
                      required
                      minlength="6"
                      class="min-w-0 grow"
                    />
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm btn-square"
                      :aria-label="showPassword ? 'Hide password' : 'Show password'"
                      :aria-pressed="showPassword"
                      @click="showPassword = !showPassword"
                    >
                      <EyeOff v-if="showPassword" class="size-4" />
                      <Eye v-else class="size-4" />
                    </button>
                  </span>
                </label>

                <p v-if="error" class="text-error text-sm" role="alert">{{ error }}</p>
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
                <button type="submit" :disabled="loading" class="btn btn-primary btn-lg w-full">
                  <span v-if="loading" class="loading loading-spinner loading-sm"></span>
                  {{ mode === 'login' ? 'Log in' : 'Create account' }}
                </button>
              </form>

              <button
                class="btn btn-link btn-sm self-center"
                @click="mode = mode === 'login' ? 'signup' : 'login'"
              >
                {{ mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in' }}
              </button>
            </template>
          </div>
        </div>
      </div>
      <!-- On the coloured desktop scene the footer sits in a small glass pill so it stays readable. -->
      <div class="lg:flex lg:justify-end lg:pr-[4vw] lg:pb-4 xl:pr-[7vw] 2xl:pr-[13vw]">
        <div class="lg:bg-base-100/75 lg:w-md lg:rounded-2xl lg:backdrop-blur lg:[&>footer]:py-3">
          <AppFooter />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dots {
  background-image: radial-gradient(rgb(255 255 255 / 0.16) 1.6px, transparent 1.8px);
  background-size: 30px 30px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 85%);
}

/* A slow, gentle bob so the scene feels alive. Each piece uses its own speed and delay. */
.bob {
  animation: bob var(--t, 7s) ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}
@keyframes bob {
  50% {
    transform: translateY(-14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bob {
    animation: none;
  }
}
</style>
