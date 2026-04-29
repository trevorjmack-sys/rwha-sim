import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Cloudflare Pages: output goes here
      routes: { include: ['/*'], exclude: [] },
    }),
    alias: {
      // Import the sim engine directly from the root src/ without copying files
      '$engine': '../src',
    },
  },
};
