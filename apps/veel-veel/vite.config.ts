import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import qrcode from 'qrcode-terminal';

const root = path.dirname(fileURLToPath(import.meta.url));
function lanAddresses() {
  return Object.entries(networkInterfaces())
    .flatMap(([name, entries]) => (entries ?? [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({ name, address: entry.address })))
    .sort((a, b) => Number(/wi-?fi|wireless|ethernet/i.test(b.name))
      - Number(/wi-?fi|wireless|ethernet/i.test(a.name)));
}
export default defineConfig({
  plugins: [
    react(),
    basicSsl({ certDir: path.resolve(root, '../../.cache/dev-cert') }),
    {
      name: 'veel-veel-lan-qr',
      configureServer(server) {
        server.middlewares.use('/dev/lan-url', (_request, response) => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' && address ? address.port : 5173;
          const origins = lanAddresses().map((entry) => ({
            label: `${entry.name} · ${entry.address}`,
            origin: `https://${entry.address}:${port}`,
          }));
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ origins }));
        });
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' && address ? address.port : 5173;
          const lanIp = lanAddresses()[0]?.address;
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
  server: {
    host: true,
    proxy: { '/api': { target: 'https://localhost:8787', changeOrigin: true, secure: false } },
  },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
