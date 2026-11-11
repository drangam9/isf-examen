import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project from /isf-examen/.
  base: '/isf-examen/',
  plugins: [react()],
})
