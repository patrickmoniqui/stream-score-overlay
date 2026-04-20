import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => {
  const useLocalWorker = process.env.USE_LOCAL_WORKER === '1';
  const proxyTarget = useLocalWorker
    ? 'http://127.0.0.1:8787'
    : 'https://api-web.nhle.com/v1';
  const rewriteApiPath = useLocalWorker
    ? (path: string) => path
    : (path: string) => path.replace(/^\/api/, '');

  return {
    base: command === 'build' ? './' : '/',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: rewriteApiPath,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          settings: resolve(rootDir, 'index.html'),
          overlay: resolve(rootDir, 'overlay.html'),
        },
      },
    },
  };
});
