<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div>
    <h1>Remind Me</h1>
    <p>Logged in as {{ auth.user?.email }}</p>
    <button @click="logout">Log out</button>
  </div>
</template>
