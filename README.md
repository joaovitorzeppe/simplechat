# SimpleChat

Chat P2P 100% frontend: áudio, vídeo, tela e texto no navegador. Sem API própria. A mídia vai de ponta a ponta (WebRTC); só a sinalização passa pelo broker gratuito do PeerJS.

## Stack e como rodar

Vite 8, React 19, TypeScript ~7, Tailwind CSS v4 e PeerJS.

```bash
npm i
npm run dev
```

Para testar duas pessoas no mesmo computador, abra uma janela anônima (o mesmo origin compartilha `localStorage` e a chave).

Idiomas: português, inglês e espanhol (`LanguageSwitcher`). Em produção o app é instalável (PWA); o service worker não registra em `npm run dev`.

## Como funciona

Toda chamada é uma sala em mesh. Quem inicia é o **host**; quem entra é convidado.

- **Identidade:** no onboarding você informa o nome. O app gera um `peerId` no formato `{nome}-{uuid}-{timestamp}` e, se você pedir para lembrar, grava `{ displayName, peerId }` no `localStorage`. Sem isso, a chave é nova a cada visita. A chave é o ID PeerJS.
- **Iniciar:** você abre a chamada sozinho e compartilha o link `/?room=<sua-chave>`. Links antigos `?call=` ainda funcionam.
- **Ligar:** cola a chave (ou o link) da outra pessoa. Você vira host e convoca ela.
- **Entrar:** junta você à chamada que a outra pessoa já começou. O cliente conecta no host por data channel; o host envia a lista de peers; cada um monta mesh de mídia (quem tem o ID menor inicia, para evitar glare).
- **Sair:** convidado só sai da sala. Se o host sair, a chamada encerra para todos (`room-ended`).
- **Câmera:** desligar a câmera para o track (`replaceTrack(null)` + `stop()`). Não envia frames pretos; o LED deve apagar. Os outros veem o avatar. Compartilhamento de tela segue em conexão separada.

## Limites do plano

O host aplica o teto do **tier dele** (`quality.ts`):

| | Free | Pro (demo) |
|---|---|---|
| Pessoas | 5 | 12 |
| Câmera | 640×480 @ 15 fps, ~400 kbps | 1280×720 @ 30 fps, ~2.5 Mbps |
| Tela | 1280×720 @ 15 fps, ~800 kbps | 1920×1080 @ 30 fps, ~4 Mbps |

O 6º no free recebe toast de sala cheia e volta para a home, sem derrubar a chamada. O toggle **Simular Pro** no `localStorage` só demonstra o tier — não há pagamento.

Num app só frontend o paywall é burável (o JS roda no navegador). A UI mostra “qualidade gratuita” e “Pro em breve”.

Isso usa `getUserMedia` / `getDisplayMedia` e `RTCRtpSender.setParameters({ encodings: [{ maxBitrate }] })`.

## Limitações de rede

WebRTC sempre precisa de sinalização, STUN e, em alguns NATs, TURN.

- Sinalização: broker gratuito `0.peerjs.com` (PeerJS).
- STUN: `stun.l.google.com` (e `stun1`).
- Sem TURN no MVP. Firewalls corporativos rígidos podem não conectar.
- Áudio/vídeo não passam pelo nosso servidor: vão P2P (ou por TURN, se um dia existir).
- Mesh em vídeo pesa no notebook. Grupo grande pediria SFU (LiveKit/mediasoup) e deixaria de ser P2P puro.

## Fase 2 (fora deste MVP)

- Recentes para religar (lista curta de `peerId` + nome), ou histórico na nuvem com conta.
- Stripe/Lemon Squeezy + custom claim para liberar o tier Pro de verdade.
- TURN (Metered, Open Relay ou coturn) para NAT difícil.
- SFU se salas passarem do que o mesh aguenta.

## Histórico de versões

Ver [CHANGELOG.md](./CHANGELOG.md).
