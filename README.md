# SimpleChat

Chat P2P 100% frontend: áudio, vídeo, tela e texto no navegador. Sem API própria. A mídia vai de ponta a ponta (WebRTC); só a sinalização passa pelo broker gratuito do PeerJS.

## Stack e como rodar

Vite 8, React 19, TypeScript, Tailwind CSS v4, PeerJS e Dexie (IndexedDB).

```bash
npm i
npm run dev
```

Para testar duas pessoas no mesmo computador, abra uma janela anônima (o mesmo origin compartilha `localStorage` e a chave).

## Como funciona

- **Identidade:** você informa o nome. O app gera um `crypto.randomUUID()`, grava `{ displayName, peerId }` no `localStorage` e abre `new Peer(peerId)`. A chave é o próprio ID PeerJS — copiar/colar ou link `?call=<uuid>`.
- **1:1:** a outra pessoa cola a chave e clica Ligar. O cliente faz `peer.call` (mídia) e `peer.connect` (chat/metadados).
- **Sala mesh:** o host cria a sala e compartilha a chave dele (`?room=<uuid>`). Quem entra conecta no host por data channel; o host envia a lista de peers; cada um monta mesh de mídia com os demais (quem tem o ID menor inicia, para evitar glare). Se o host sair, a sala encerra.

## Limitações

WebRTC sempre precisa de sinalização, STUN e, em alguns NATs, TURN.

- Sinalização: broker gratuito `0.peerjs.com` (PeerJS).
- STUN: `stun.l.google.com` (e `stun1`).
- Sem TURN no MVP. Firewalls corporativos rígidos podem não conectar.
- Áudio/vídeo não passam pelo nosso servidor: vão P2P (ou por TURN, se um dia existir).
- Mesh funciona bem com até ~4 pessoas em vídeo. Acima disso o notebook sofre; grupo grande pediria SFU (LiveKit/mediasoup) e deixaria de ser P2P puro.

## Qualidade free/pro e paywall futuro

O módulo `quality.ts` trava resolução, fps e bitrate no cliente:

- **Free:** 640×480 @ 15 fps, ~400 kbps câmera, ~800 kbps tela.
- **Pro:** 1280×720 @ 30 fps, ~2.5 Mbps câmera, ~4 Mbps tela.

Isso usa `getUserMedia` / `getDisplayMedia` e `RTCRtpSender.setParameters({ encodings: [{ maxBitrate }] })`.

Num app só frontend o paywall é burável (o JS roda no navegador). No MVP o tier padrão é free, a UI mostra “qualidade gratuita” e “Pro em breve”, e há um toggle local **Simular Pro** só para demonstrar a diferença. Sem pagamento.

## Fase 2 (fora deste MVP)

- Firebase Auth (Google) + Firestore para histórico na nuvem; IndexedDB continua como modo anônimo.
- Stripe/Lemon Squeezy + custom claim para liberar o tier Pro de verdade.
- TURN (Metered, Open Relay ou coturn) para NAT difícil.
- SFU se salas > 4–6 pessoas.

## Histórico

- **30/08/2026** — MVP: onboarding com nome e chave UUID, chamada 1:1 (áudio/vídeo + chat), compartilhamento de tela, salas mesh, histórico local com opt-in, tiers de qualidade e UI “Pro em breve”.
