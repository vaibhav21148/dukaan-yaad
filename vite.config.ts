import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Dukaan Yaad',
        short_name: 'Dukaan Yaad',
        description: 'Talk for 60 seconds at closing time; the app remembers supplier dues, stock, udhaar and orders.',
        lang: 'hi',
        theme_color: '#b3122c',
        background_color: '#b3122c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached. Fonts are cached at runtime (only the scripts actually used).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/ort-*.wasm', '**/*.worker*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/') && /\.(woff2?|ttf)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // Whisper worker chunk + ONNX runtime wasm (fetched only after the offline pack download)
            urlPattern: ({ url }) => (url.pathname.includes('/assets/') && /worker|ort-/.test(url.pathname)) || url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'stt-runtime', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  server: { proxy: process.env.API_PROXY ? { '/api': process.env.API_PROXY } : undefined },
});
