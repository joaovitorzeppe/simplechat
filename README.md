# SimpleChat

Chat P2P 100% frontend: áudio, vídeo, tela e texto no navegador. Sem API própria. A mídia vai de ponta a ponta (WebRTC); só a sinalização passa pelo broker gratuito do PeerJS.

## Stack e como rodar

Vite 8, React 19, TypeScript ~7, Tailwind CSS v4 e PeerJS.

```bash
npm i
npm run dev
npm run lint
npm test
```

Para testar duas pessoas no mesmo computador, abra uma janela anônima (o mesmo origin compartilha `localStorage` e a chave).

Idiomas: português, inglês, espanhol, francês e italiano (`LanguageSwitcher`). Tema claro e escuro (`ThemeToggle`): na primeira visita segue o sistema; depois a escolha fica neste navegador. Em produção o app é instalável (PWA); o service worker não registra em `npm run dev`.

Na Vercel, um path sem arquivo (ex.: `/foo`) devolve o SPA — onboarding se não houver identidade, home se houver. Query e hash do convite (`?room=` e `#k=`) são preservados. Web Analytics e Speed Insights medem visitas e Core Web Vitals; o envio tira query e hash para o segredo da sala não ir para a Vercel. Os dois precisam estar ligados no painel do projeto.

Produção: [https://simplechat.me](https://simplechat.me) redireciona para [https://www.simplechat.me](https://www.simplechat.me). Convites usam a origem do navegador (`/?room=…#k=…`). `robots.txt` impede indexar URLs com query; o canonical aponta para a home. Termos e privacidade ficam em `/terms` e `/privacy` (o cliente não joga esses pathnames para `/`).

## Como funciona

Toda chamada é uma sala em mesh. Quem inicia é o **host**; quem entra é convidado.

- **Identidade:** no onboarding você informa o nome. O app gera um `peerId` opaco e, se você pedir para lembrar, grava `{ displayName, peerId }` no `localStorage`. Sem isso, a chave é nova a cada visita. A chave é o ID PeerJS.
- **Iniciar:** você abre a chamada sozinho e compartilha o link `/?room=<sua-chave>#k=<segredo>`. Links antigos `?call=` ainda funcionam, mas sem o fragmento não entram mais.
- **Ligar:** cola a chave (ou o link) da outra pessoa. Você vira host e convoca ela.
- **Entrar:** junta você à chamada que a outra pessoa já começou. Abrir o link sem identidade passa pelo onboarding e entra na sala em seguida. O cliente conecta no host por data channel e fica na **sala de espera** até o host aprovar; então o host envia a lista de peers e cada um monta mesh de mídia (quem tem o ID menor inicia, para evitar glare). Quem o host discou entra direto, sem passar pela espera.
- **Moderação:** o host aprova ou recusa cada entrada e pode remover alguém da chamada. Recusado e removido ficam bloqueados por `peerId` e, como o segredo gira junto, o link que eles têm deixa de valer.
- **Sair:** convidado só sai da sala. O host escolhe entre passar o papel adiante (`host-transfer`) ou encerrar para todos (`room-ended`).
- **Queda do host:** se ele some sem avisar, quem ficou elege o substituto sozinho — o menor `peerId` entre os membros. Como a lista veio do host e é a mesma em todos, todos chegam ao mesmo nome sem negociar. Sobrando uma pessoa só, a chamada encerra.
- **Câmera e microfone:** desligar a câmera para o track (`replaceTrack(null)` + `stop()`). Não envia frames pretos; o LED deve apagar. Os outros veem o avatar. Compartilhamento de tela segue em conexão separada.
- **Entrar sem mídia:** a entrada tenta áudio+vídeo, depois só áudio, só vídeo, e por fim só ouvir e chat. Sem câmera ou microfone (dispositivo ausente ou permissão recusada) você ainda entra; um toast avisa o que faltou. Religar mic ou câmera na barra pede o dispositivo de novo.
- **Silenciar outros:** nos tiles, qualquer um pode desligar o áudio ou o vídeo de outra pessoa **só para si**. O host não pode ser silenciado. O host também pode silenciar para a **sala inteira** (`room-mute`); aí ninguém reativa — nem a pessoa alvo — até ele liberar.
- **Chat e menções:** `@` depois de espaço (ou no começo) abre o seletor; `@all` marca todo mundo. O fio leva `peerId`, não o nome. Quem foi marcado vê a bolha em destaque e um toast. E-mails (`ana@site.com`) não abrem o seletor.
- **Comandos:** `/` no começo da mensagem (ou depois de espaço) abre o seletor. O resultado viaja estruturado; cada cliente formata no próprio idioma. `/ajuda` só aparece para quem digitou. Nomes no seletor seguem o idioma da interface (`/dado`, `/roll`, `/dé`…).
  - `/dado` — 1d20, `2d6`, intervalo (`1-100`) ou expressão (`2d6*3`, `2 5d10+7d4+3`).
  - `/sortear` — escolhe alguém da sala. `/escolher pizza, sushi` — sorteia entre opções. `/ordem` — embaralha a sala. `/moeda` — cara ou coroa. `/me acena` — ação no chat (`@` na frase conta como menção).
  - `/timer 5m` — cronômetro visível para a sala (`5` = minutos; também `30s`, `1h`, `1h30m`). Mínimo 5 segundos, máximo 2 horas. Ao acabar, um toast avisa mesmo com o chat fechado.
  - `/voto pizza, sushi` — votação clicável (2 a 12 opções). Dá para trocar de opção. O voto no fio é `poll-vote`; a identidade vem da conexão, não do payload.
- **Arquivo:** clipe no chat. Vai P2P no data channel, em pedaços. A montagem e a leitura das fatias rodam num worker (com fallback na thread da UI). Imagens (jpeg/png/gif/webp) têm prévia; o resto só baixa. Some ao sair da chamada.
- **Recentes:** quem já esteve numa chamada com você aparece na home para Ligar de novo. Não reabre a sala antiga: o segredo do convite gira.

## Limites do plano

O host aplica o teto de **pessoas** do plano dele. **Enviar arquivo no chat é só Pro**; o teto de tamanho vale para quem envia (`quality.ts`). O free continua recebendo:

|                 | Free                         | Pro (demo)                   |
| --------------- | ---------------------------- | ---------------------------- |
| Pessoas         | 5                            | 12                           |
| Arquivo no chat | — (só recebe)                | envia até 100 MB             |
| Câmera          | 640×480 @ 15 fps, ~400 kbps  | 1280×720 @ 30 fps, ~2.5 Mbps |
| Tela            | 1280×720 @ 15 fps, ~800 kbps | 1920×1080 @ 30 fps, ~4 Mbps  |

O 6º no free recebe toast de sala cheia e volta para a home, sem derrubar a chamada. O toggle **Simular Pro** no `localStorage` só demonstra o tier — não há pagamento.

Num app só frontend o paywall é burável (o JS roda no navegador). A UI mostra “qualidade gratuita” e “Pro em breve”.

Isso usa `getUserMedia` / `getDisplayMedia` e `RTCRtpSender.setParameters({ encodings: [{ maxBitrate }] })`.

## Limitações de rede

WebRTC sempre precisa de sinalização, STUN e, em alguns NATs, TURN.

- Sinalização: broker gratuito `0.peerjs.com` (PeerJS).
- STUN: `stun.l.google.com` (e `stun1`).
- Sem TURN, NAT simétrico e firewall corporativo não conectam. O app detecta ICE que nunca fecha e avisa para trocar de rede (Wi‑Fi ↔ dados móveis).
- Áudio/vídeo não passam pelo nosso servidor: vão P2P (ou por TURN, quando configurado).
- Mesh em vídeo pesa no notebook. Grupo grande pediria SFU (LiveKit/mediasoup) e deixaria de ser P2P puro.

Para ligar o TURN, defina as três variáveis (em `.env.local` ou no painel da Vercel). Faltando qualquer uma, o app segue só com STUN:

```bash
VITE_TURN_URL=turn:seu-servidor:3478
VITE_TURN_USERNAME=usuario
VITE_TURN_CREDENTIAL=senha
```

## Modelo de confiança

O link chega a qualquer um, então **todo participante é tratado como potencialmente hostil**. Três regras sustentam isso:

- **Nada que chega pelo data channel é confiável.** `parseWire` (`wire-guard.ts`) valida formato, tipo e tamanho de cada campo antes de a mensagem chegar à sessão. O que não bate com o contrato é descartado, não corrigido.
- **A identidade vem da conexão, nunca do payload.** O remetente de um chat, arquivo ou voto é sempre `conn.peer`. Encerrar a sala, anunciar a lista de peers, silenciar na sala (`room-mute`) ou transferir o papel de host só é aceito do host (ou, antes do host existir, do peer que você discou). Silenciar o host, mesmo forjado no fio, é ignorado.
- **A sala é a lista que o host anuncia, e não há entrada por fora dela.** Isso vale inclusive entre convidados: como todos conhecem o `peerId` de todos pela lista da sala, um convidado que aceitasse conexão de qualquer um seria uma porta lateral sem tranca. Quem não está na lista não é atendido, não entra em broadcast e tem toda mensagem além do `hello` descartada.
- **A entrada exige o segredo do link.** O host guarda um segredo de sala e o link de convite o carrega no fragmento (`#k=`), que o navegador não envia ao servidor nem repassa no `Referer`. Sem o segredo certo, o pedido nem chega a incomodar o host.

Arquivos recebidos são acumulados em pedaços conforme chegam — o tamanho anunciado não reserva memória — com teto global, limite de transferências simultâneas e cooldown por peer. A leitura das fatias no envio e a montagem na recepção saem da thread da UI via worker; o DataChannel em si fica na thread principal, porque o RTCDataChannel não é transferível. Sem Worker, o mesmo código roda in-process. Quando o OPFS existe, os bytes recebidos vão para o disco privado do origin durante a transferência, e só viram Blob no fim.

**Recusar ou remover alguém gira o segredo.** Só o banimento por `peerId` não seguraria: bastaria limpar o `localStorage` para voltar com chave nova. Girando, todo link já distribuído morre junto, e os membros que ficaram recebem o segredo novo pelo `room-peers` — quem saiu, não. Para voltar, a pessoa precisaria de um convite novo _e_ da aprovação do host.

O `peerId` é opaco (128 bits em base36, sem nada do nome), porque ele trafega em claro pelo broker público do PeerJS. Chaves antigas, que embutiam o primeiro nome, são trocadas na primeira carga — links gerados antes disso param de funcionar.

O que continua fora do escopo: sem servidor e sem conta, nada impede que um membro atual repasse o link para quem foi removido.

## Texto e idiomas

Nomes e mensagens são cortados por grafema (`text.ts`, via `Intl.Segmenter`), não por índice: emoji, hangul decomposto e clusters índicos ou tâmeis nunca são partidos ao meio. O teto é contado em unidades UTF-16, a mesma régua do `maxLength` do input e da validação do wire, então o que a interface deixa digitar é exatamente o que passa na outra ponta. O nome aceita até 100.

As fontes embutidas (Outfit e IBM Plex Mono) cobrem só latino e latino estendido, e o `unicode-range` delas faz o navegador cair automaticamente na fonte do sistema para japonês, chinês, coreano, devanágari, árabe e afins — sem tofu e sem download extra.

## Fase 2 (fora deste MVP)

- Stripe/Lemon Squeezy + custom claim para liberar o tier Pro de verdade.
- TURN (Metered, Open Relay ou coturn) para NAT difícil — o código já lê as variáveis; faltam as credenciais.
- SFU se salas passarem do que o mesh aguenta.

## Histórico de versões

Ver [CHANGELOG.md](./CHANGELOG.md).
