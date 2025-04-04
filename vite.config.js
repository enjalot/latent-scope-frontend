import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const mode = process.env.MODE || 'development';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `https://latent.estate/` : '/',
  // base: '/',
  plugins: [react(), wasm(), topLevelAwait()],
  build: {
    outDir: `dist/${mode}`,
  },
}));
