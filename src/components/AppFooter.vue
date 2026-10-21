<script setup>
// The year updates by itself, so the footer never goes out of date.
const year = new Date().getFullYear()
</script>

<template>
  <footer class="text-base-content/50 py-6 text-center text-xs">
    <p>
      © {{ year }} Remind Me · Built by <span class="text-base-content/70 font-semibold">VantixFlow</span>
    </p>
    <p class="mt-1">
      <a
        href="https://github.com/AybanFred/remind-me"
        target="_blank"
        rel="noopener noreferrer"
        class="link link-hover"
      >
        View the source on GitHub
      </a>
    </p>
  </footer>
</template>
