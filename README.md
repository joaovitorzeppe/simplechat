# SimpleChat

Peer-to-peer audio, video, screen share, and chat in the browser. No app backend — media stays WebRTC end-to-end; only signaling uses the free PeerJS broker.

Live: [www.simplechat.me](https://www.simplechat.me)

## Run locally

```bash
npm i
npm run dev
npm run lint
npm test
```

Stack: Vite, React, TypeScript, Tailwind CSS, PeerJS. To try two peers on one machine, use a normal window plus a private window (same origin shares `localStorage`).

## How it works

Every call is a mesh room. Whoever starts is the **host**; others join via invite link and wait in a lobby until the host admits them.

- **Start** a call from the home screen, then copy the invite (`/?room=…#k=…`). The `#k=` room secret stays in the URL fragment (not sent to the server).
- **Join** only through that link. The host can admit, deny, or remove people; deny/remove rotates the room secret so old links die.
- **Leave:** guests leave alone; the host can hand off host duties or end the room for everyone. If the host disconnects, the remaining peers elect a new host (lowest `peerId`).
- **Chat:** mentions (`@`), slash commands, polls, timers, and P2P file transfer. Details live in the UI and in `src/`.

UI languages: Portuguese, English, Spanish, French, Italian. Light/dark theme. Installable as a PWA in production.

## Limits

|           | Cap                          |
| --------- | ---------------------------- |
| People    | 12                           |
| Chat file | 100 MB                       |
| Camera    | 1280×720 @ 30 fps, ~2.5 Mbps |
| Screen    | 1920×1080 @ 30 fps, ~4 Mbps  |

See `src/lib/quality.ts`.

## Network

Signaling: PeerJS (`0.peerjs.com`). STUN: Google. Without TURN, some NATs and corporate firewalls fail — the app asks you to switch Wi‑Fi ↔ mobile data when ICE never connects.

Optional TURN (`.env.local` or Vercel env). All three required; otherwise STUN only:

```bash
VITE_TURN_URL=turn:your-server:3478
VITE_TURN_USERNAME=user
VITE_TURN_CREDENTIAL=secret
```

`VITE_*` values are baked into the client bundle — treat them as public to anyone who loads the page.

Large video meshes are heavy on clients. Bigger rooms would need an SFU and stop being pure P2P.

## Trust model

Anyone with the invite link can try to join, so every peer is treated as untrusted:

- Data-channel payloads are validated (`wire-guard.ts`) before they touch session state.
- Identity comes from the connection (`conn.peer`), never from the message body.
- Only the host’s announced peer list defines the room; side-door connections are refused.
- Entry needs the fragment secret; refuse/remove rotates it.

A current member can still forward a fresh invite. Without accounts or a server, that stays out of scope.
