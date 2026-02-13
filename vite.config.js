import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:4000';

  return {
    server: {
      proxy: {
        '/api/v1': localTarget,
      },
    },
    plugins: [react(), tailwindcss()],
  };
})
