import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Studio is deployed as its own Vercel project rooted at this `studio/` dir.
export default defineConfig({
  plugins: [react()],
})
