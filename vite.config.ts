import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Dev only: serve /api/* from the same files Vercel deploys, so `npm run dev` + .env.local works like production. */
function devApi(): Plugin {
  return {
    name: 'dukaan-dev-api',
    configureServer(server: ViteDevServer) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!/^[a-z]+$/.test(name)) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const r: Response = await handler(new Request(`http://localhost/api/${req.url}`, { method: req.method, headers, body }));
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    devApi(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Dukaan Yaad',
        short_name: 'Dukaan Yaad',
        description: 'Talk for 60 seconds at closing time; the app remembers supplier dues, stock, udhaar and orders.',
        lang: 'hi',
        theme_color: '#FAFAF8',
        background_color: '#FAFAF8',
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
});
