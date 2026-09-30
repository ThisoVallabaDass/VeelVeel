import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import qrcode from 'qrcode-terminal';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    {
      name: 'veel-veel-lan-qr',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' && address ? address.port : 5173;
          const lanIp = Object.values(networkInterfaces())
            .flat()
            .find((item) => item && item.family === 'IPv4' && !item.internal)?.address;
          const url = `https://${lanIp ?? 'localhost'}:${port}`;
          console.log(
            `\nVeel Veel mic-ready dev URL: ${url}\nTrust the local dev certificate on your phone before opening it.\n`,
          );
          qrcode.generate(url, { small: true });
        });
      },
    },
  ],
  publicDir: path.resolve(root, '../../packs'),
  // basicSsl() injects its generated certificate into Vite's HTTPS options.
  server: { host: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
