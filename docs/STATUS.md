# Veel Veel build status

## Working now

- The pack indexer turns 534 existing source clips into normalized 22.05 kHz mono WAV, feature JSON, difficulty levels and `pack.json`. Source media and the Python harvester remain untouched.
- A checkout without local source media generates twelve synthesized demo sounds so `pnpm dev` still opens a playable local game.
- The browser app has local HTTPS development, a QR LAN address, microphone setup, the two procedural stage themes, the arena sandbox, local Mic Drop, 5/8/12 round selection, bots, six starter Chaos Cards, a once-per-game Golden Buzzer, local roast playback and a final podium.
- A secure room relay and host/phone screens now run alongside the game. A host can create a four-letter room, invite up to five phone singers with a QR code or LAN link, choose a network address when multiple adapters are present, sing together or take turns, score uploaded short takes in the host browser, reveal standings and finish a game. Rejoin tokens and in-memory room expiry are implemented. A two-phone Playwright round, including a phone reload/rejoin, passes.
- The score engine uses a longer pitch analysis window and caps one-note attempts on clearly melodic clips. The synthetic comparison tests cover identical takes, five-semitone transposition, time stretch, noise, silence and one-note imitation. The room e2e matching take scores in the 90s.
- Room score reveals now show rhythm, melody, energy and vibe to all singers, including phones that rejoin mid-reveal.
- Procedural singers now have articulated arms/legs, outfits, facial features, mouth and brow animation, a step toward center while singing, celebration/flop reactions and a bouncing instanced crowd. Original Web Audio cues accompany starts, recording and score reveals. Optional browser speech voices perform short judge reactions.
- The pack indexer accepts owner-supplied Tamil and English WAV additions through `data/catalog/extra-clips.jsonl`, preserving language and source metadata. The current 534 clips remain the existing Tamil library; no TikTok or Instagram audio was imported.
- Audio capture uses an AudioWorklet and on-device DSP. Chromium with a fake microphone completes five rounds and scores the matching first clip at least 90. Real clip and synthetic DSP tests pass.
- `docs/screens/` contains Home, Mic Setup, Lobby, both theme previews, HUD, judge reveal, podium, room host/phone and phone judge scores. Browser screenshots use `?e2e=1` to avoid a headless software WebGL stall.

## Known limits

- The 3D characters are stylized procedural models, not realistic human avatars. Full character customization, rigged character assets, advanced camera choreography, crowd shader and post-processing remain unbuilt. Integrated GPU FPS and draw-call targets remain unmeasured.
- The local game has one human singer and four scored bots. Bot playback is a transformed reference clip, and the modes after Mic Drop remain unavailable.
- Chaos Cards in this milestone cover the first six by name and local scoring/playback behavior. Whisper and Tomato scoring are simplified; the full data-driven transform interface remains for later work.
- The app has no IndexedDB feature cache, scheduled Web Audio SFX suite, highlight reel or share-card export yet.
- The normal Three.js renderer has not been measured on an integrated GPU; FPS and draw-call targets remain unverified.
- Room play currently covers Mic Drop with phones as controllers. It does not yet include bleed detection, compact feature-track uploads, LocalTransport/WebSocketTransport abstraction, or room play for the other modes. The server retains rooms in memory; restart ends the party. Spoken judge voice quality depends on voices installed in each browser/OS.
- Last Voice Standing, Sound Whispers, Asal/Nakal, Voice Charades, Daily Stage, Clip Lab and Remix Riot are still unbuilt. The current local game remains one human singer and four bots.
- Public hosting has not been selected or deployed. The only current links are localhost and the reachable private LAN. The current clips have source URLs but no verified redistribution rights; publish only cleared media.

## Next work

Finish the remaining modes and avatar pipeline, measure stage performance on target devices, complete feature-track and bleed handling, then deploy with licensed audio to the hosting destination the owner chooses.
