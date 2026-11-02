import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Control P&V', short_name: 'Control P&V', lang: 'es',
        description: 'Registro de perforación y voladura en frentes de avance',
        theme_color: '#0c1013', background_color: '#0c1013', display: 'standalone', orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
