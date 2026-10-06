import { defineConfig } from 'vite';

const SERVER = 'http://localhost:4464';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/emulatorjs': SERVER,
      '/themes': SERVER,
      '/roms': SERVER,
      '/player.html': SERVER
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist'
  }
});
