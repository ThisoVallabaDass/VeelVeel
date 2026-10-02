# Local play and mic setup

1. Install Node.js 20.19+ and pnpm 11, then run `pnpm install`.
2. Run `pnpm dev`. This indexes the source pack, then starts the HTTPS game on port 5173 and the secure room relay on port 8787. The terminal prints a LAN URL and QR code. Use `pnpm pack:index` alone to refresh the pack.
3. For local Mic Drop, open `https://localhost:5173/`, choose **Play Local**, connect and calibrate the mic, then complete the voice check.
4. For a room, open `https://localhost:5173/host` on the host screen and create a code. To play solo or sing alongside friends, tap **Join as Singer**, **Connect Microphone**, then **I Am Ready** on the host screen; **Start the Show** becomes available. The host page also shows a QR and LAN join URL for phones. If the computer has more than one network adapter, choose the address that your phones can reach. Up to five singers total can join, including the host. The host chooses **All at once** or **Take turns**, starts a round, and reveals the four judge scores after the takes arrive.
5. The development certificate is self-signed. On each phone, open both `https://<LAN-IP>:5173/` and `https://<LAN-IP>:8787/health`, then accept or trust the certificate in the browser/OS before using the mic. Keep ports 5173 and 8787 reachable on your private LAN. Headphones reduce audio bleed.

Local mic samples stay on the device. Room phones downsample takes to 22.05 kHz mono PCM16, upload at most eight seconds to the relay, and the relay forwards the take to the host browser for scoring. The relay holds only room state and cumulative scores in memory. It does not write takes to disk. Public use needs an HTTPS reverse proxy routing `/room` WebSockets to the Node server; see `docs/DEPLOY.md`.
