import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Run `npm run generate-pwa-assets` to rebuild the PNG icons from public/icon.svg.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
