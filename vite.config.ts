// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

// Auto-detect HTTPS certs in project root (any .crt/.key pair)
const certFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.crt'));
const certBase = certFiles.length > 0 ? certFiles[0].replace(/\.crt$/, '') : null;
const certPath = certBase ? path.resolve(__dirname, `${certBase}.crt`) : '';
const keyPath = certBase ? path.resolve(__dirname, `${certBase}.key`) : '';
const hasCerts = certBase ? fs.existsSync(certPath) && fs.existsSync(keyPath) : false;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    ...(hasCerts && {
      https: {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      },
    }),
  },
});
