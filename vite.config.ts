import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function disableViteClientWs(): Plugin {
  return {
    name: 'disable-vite-client-ws',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return {
          code: code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled */'
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), disableViteClientWs()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: false,
    ws: false,
  },
});
