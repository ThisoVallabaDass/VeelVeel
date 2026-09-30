# Local play and mic setup

1. Install Node.js 20.19+ and pnpm 11, then run `pnpm install`.
2. Run `pnpm dev`. This indexes the source pack automatically, then Vite starts HTTPS, binds to the LAN, prints a QR code and shows the detected LAN address. Your phone and computer must share Wi-Fi. Use `pnpm pack:index` alone to refresh the pack without starting the app. The sources remain under `data/`; generated normalized audio and features go to the ignored `packs/tamil-meme/` folder.
4. The Vite basic SSL certificate is self-signed. For a phone, trust the local development CA/certificate in the OS/browser before using microphone access. If your browser refuses the certificate, use a temporary HTTPS tunnel such as `cloudflared tunnel --url https://localhost:5173 --no-tls-verify`; keep the app and tunnel on a trusted network.
5. On the app's Mic Check screen, allow microphone access, tap **Calibrate Room Noise** in a quiet moment, then say “Veel Veel!” during **Test My Voice**. Headphones help avoid room feedback.

Mic samples are captured in an AudioWorklet, downsampled locally to 22.05 kHz mono PCM16 and scored in the browser. The latest take stays in memory for roast replay until the next round. No capture route sends microphone audio to the room relay.
