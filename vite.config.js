import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => funziona sia su username.github.io/nome-repo/ sia in locale
export default defineConfig({
  plugins: [react()],
  base: './',
});
