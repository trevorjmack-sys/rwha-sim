import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Ensure the sim engine (../src/) is bundled correctly — it uses no Node built-ins
  ssr: {
    noExternal: [],
  },
});
