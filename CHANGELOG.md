# Changelog

Histórico do SimpleChat, agrupado a partir dos commits do git. O mais recente vem primeiro.

O formato segue a ideia de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

Tudo o que entrou depois do primeiro CHANGELOG.

### Open source e limites únicos

- Removidos plano Free/Pro, toggle “Simular Pro”, badge de qualidade e chaves i18n ligadas a paywall.
- Limites antigos do Pro passam a ser o padrão para todos: 12 pessoas, arquivo até 100 MB, câmera 720p @ 30 fps, tela 1080p @ 30 fps.
- Direção: projeto open source; doações (Ko-fi) ficam para depois, quando a conta estiver pronta.

### Fluxo da home e convite

- Home só com **Iniciar chamada**. Removidos chave/link próprios na UI, Ligar/Entrar por chave e a lista de Recentes (`recents` e `callPeer` saíram).
- Entrar na sala = abrir o link de convite (deep link). Compartilhar o link acontece **depois**, na chamada (copiar convite também no mobile).
- Termos e privacidade alinhados: chave não aparece na interface; não guardamos mais “pessoas recentes” no aparelho.

### Chamada e tela

- Botão de compartilhar tela some quando não há `getDisplayMedia` (comum em alguns mobiles).
- Com tela compartilhada: ocultar câmeras para dar espaço; várias telas dividem o palco; fixar uma prioriza ela; com câmeras ocultas e uma fixada, as outras telas também somem.

### Comandos do chat

- `/escolher`: mostra as opções e, na linha de baixo, a sorteada.
- `/moeda`: `@nome jogou uma moeda: cara|coroa`.
- `/timer`: um ativo por vez; quem enviou e o host pausam, retomam ou cancelam (`timer-control` no fio).

### Segurança, performance e confiabilidade

Commit: `f92fd3a`.

Auditoria do stack P2P (segurança, CPU/memória, bugs). Altos e médios fechados; TURN estático no bundle ficou de fora de propósito.

- **Segredo da sala:** sai do `metadata` do PeerJS (não ia para o broker); continua só no hello do data channel e em `room-peers`. Abrir sala (`createRoom`) gira o segredo — convite antigo morre.
- **Call:** um `ChatPanel` (overlay só no mobile); `useSessionSelector` + `CallStage`/`CallChatDock`; `patch` no-op e `upsertRemote` sem reavisar se nada mudou.
- **Speak-level:** um `SpeakBus` (rAF único) em vez de analyser por tile.
- **Arquivos:** finish do OPFS devolve o `File` do disco (sem `arrayBuffer` completo) e `release` na revoke; envio com concurrency 3; se alguém cai no meio, toast `filePartial`; envio até 100 MB.
- **SW:** cache `simplechat-v2`; assets `/assets/*` hashed são network-only (não acumulam).
- **Chat hostil:** cooldown por peer, toast de `@` coalescido, teto de timers ativos; `displayName` do metadata de call passa por `clampDisplayName`.
- **Mídia/UI:** `video.play()` após `srcObject`; handlers estáveis no `VideoTile` (`peerId` + métodos da sessão); `NotAllowedError` para a cascata do `getUserMedia`; timeouts de “copiado” limpos no unmount.
- **CSP/tema:** bootstrap do tema em `/theme-boot.js` (sem script inline). Fontes IBM Plex só no `main`.
- **room-mute:** viewers já silenciam na tile; comment deixa claro o teto P2P (remetente hostil ainda pode enviar bytes).

### Produção

- Domínio `simplechat.me` na Vercel; o apex redireciona para `www.simplechat.me`.
- `robots.txt` (não indexa `?room=`), `sitemap.xml`, canonical, Open Graph e JSON-LD apontando para `https://www.simplechat.me/`.
- Páginas `/privacy` e `/terms` (textos nos idiomas da interface). Links no onboarding e na home; o SPA deixa esses pathnames no ar.

### Comandos do chat

Commits: `c5264d3`, `183c5e1`, `8cc398a`.

- `/` no começo da mensagem (ou depois de espaço) abre o seletor. URLs e frações (`https://`, `1/2`) não disparam. O resultado viaja como payload; cada cliente formata no próprio idioma. `/ajuda` não vai para a rede.
- `/dado`: 1d20 sem argumentos, `2d6`, intervalo (`1-100`) e expressões (`5d10+7d4+3`, `*` `/` com precedência, repetição `2 5d10+7d4+3`). Tetos de dados, faces, termos e repetições.
- `/sortear` marca alguém da sala. `/escolher` sorteia entre opções (vírgula ou espaço, 2 a 12). `/ordem` embaralha a sala. `/moeda` cara ou coroa. `/me` ação no chat (`@` na frase conta como menção).
- `/timer`: `5` = minutos; também `30s`, `5m`/`5min`, `1h`, `1h30m`. Mínimo 5 s, máximo 2 h. Card com contagem; ao acabar, toast mesmo com o chat fechado. Cada cliente conta a partir do horário local da mensagem, sem relógio do remetente. (Pausa/cancelamento e um timer por vez: ver seção “Comandos do chat” no topo de Não publicado.)
- `/voto`: enquete clicável com as mesmas regras de opções do `/escolher`. Trocar de opção vale; o mesmo voto não reenvia. No fio, `poll-vote` com identidade em `conn.peer` — votos no payload do chat são ignorados.

### Tema, idiomas e observabilidade

Commits: `7cc65eb`, `93158ed`, `082bfea`.

- Francês e italiano. Dicionários em `src/i18n/locales/`; o português continua a fonte das chaves.
- Tema claro e escuro, com persistência (`simplechat.theme`) e fallback para `prefers-color-scheme`.
- Path desconhecido na Vercel reescreve para o `index.html` (exceto `/_vercel/`). O cliente joga o pathname para `/` e mantém query e hash do convite.
- Web Analytics e Speed Insights. Antes de enviar, query e hash saem da URL — o `#k=` do convite não vai para a Vercel. O service worker não intercepta `/_vercel/`.

### UI

Commits: `c452ad2`, `efdb20f`, `085b2a7`, `c909fbc`.

- Tooltip nos botões; em toque, controle desabilitado mostra o motivo num toast.
- Anel no tile de quem está falando, proporcional ao volume.
- Mic e câmera desligados usam o mesmo vermelho do encerrar chamada.
- Removido o protótipo de desfoque de fundo (MediaPipe).

### Sala, convite e host

Commits: `845b1ee`, `01ca868`, `a56b288`.

- Convite com segredo no fragmento: `/?room=<chave>#k=<segredo>`. Sem o `#k=` certo, o pedido nem chega ao host. Recusar ou remover alguém gira o segredo; o link antigo deixa de valer.
- Quem abre o convite sem identidade passa pelo onboarding e, com o broker pronto, entra na sala sozinho.
- Sala de espera: quem entra pelo link fica no lobby até o host aprovar.
- Host pode recusar a entrada e remover alguém da chamada. Recusado e removido ficam bloqueados por `peerId`.
- Host que sai escolhe passar o papel (`host-transfer`) ou encerrar para todos. Se o host some sem avisar, o menor `peerId` entre quem ficou assume; sobrando uma pessoa, a chamada acaba.

### Chat, arquivos e menções

Commits: `872b2f8`, `395ac4c`, `2732ee2`, `1f4e155`.

- Links no chat viram texto clicável. Antes de abrir, um aviso mostra o endereço com Cancelar ou Abrir em nova aba.
- Arquivos no chat via data channel P2P. Envio até **100 MB**. Preview de jpeg/png/gif/webp; o resto só baixa. Some ao sair da chamada.
- Leitura e montagem das fatias no worker (fallback na UI). Com OPFS, os bytes recebidos vão para o disco do origin durante a transferência.
- Quando alguém sai, os outros veem toast e uma linha no chat com o nome.
- Menções no chat: `@` depois de espaço abre o seletor (roster + `@all`). O fio leva `peerId` (ou `"all"`), não o nome. E-mails não disparam o picker. Quem foi marcado vê a bolha em destaque e um toast; quem enviou, não.

### Silenciar áudio e vídeo

- Qualquer participante pode desligar o áudio ou o vídeo de outra pessoa **só para si** (não vai para o fio). O host não é alvo: não há controle no tile dele, e `room-mute` apontando para o host é ignorado.
- O host pode silenciar para si ou para a **sala inteira**. Mute de sala chega por `room-mute` (só o host) e no snapshot de `room-peers` para quem entra depois. Quem foi silenciado na sala não religa mic/câmera até o host liberar; os outros também não reativam para si.
- Ao liberar, mic e câmera da pessoa **não voltam sozinhos** — ela religa se quiser.

### Entrada sem câmera ou microfone

- Criar sala ou entrar pelo link não exige mais os dois dispositivos. A cascata tenta áudio+vídeo, depois só áudio, só vídeo, e por fim entra só ouvindo (chat + receber mídia dos outros).
- Toast avisa o fallback. Religar microfone ou câmera na barra pede o dispositivo de novo. A chamada de mídia atende mesmo com stream vazio, para quem entrou sem tracks ainda receber áudio/vídeo.

### Rede P2P

- ICE que **nunca** chega em `connected` (e entrada presa em “Conectando…” por ~25s) deixa de parecer que a pessoa saiu. O app avisa para trocar Wi‑Fi ↔ dados móveis. Queda depois de a mídia já ter fluído continua como saída.

### Segurança e texto

- `parseWire` valida cada mensagem do data channel antes da sessão. O remetente é sempre `conn.peer`, nunca o payload.
- `peerId` opaco (128 bits em base36). Chaves antigas com o primeiro nome no ID são trocadas na primeira carga.
- Nomes e mensagens cortados por grafema (`Intl.Segmenter`), com o mesmo teto UTF-16 do input e do wire.

### App

Commits: `01ca868`, `190e4ac`.

- Lobby na chamada, Error Boundary, fontes Outfit e IBM Plex Mono (latino; o resto cai na fonte do sistema).
- Imports entre pastas usam alias: `@i18n/*`, `@libs/*`, `@components/*`, `@screens/*`.
- TURN opcional por `VITE_TURN_URL`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL`. Sem as três, segue só STUN.
- Vitest (`npm test`); testes em `tests/` (wire, convite, identidade, arquivo, chat, menções, comandos, mute, mídia, sessão, timer, texto, tema, path SPA, observabilidade, legal).

### Removido

Commit: `3e0005b`.

- Histórico local: tela, Dexie/IndexedDB, opt-in no onboarding e gravação de chamadas/mensagens. O chat continua só enquanto a chamada está aberta.

## [2026-08-31]

MVP até a chamada unificada.

### Chamada unificada, convites, limite e câmera

Commits: `3295717`, `00c2a5b`.

- Chamada sempre é sala/mesh. Quem inicia é host; convidado que desliga só sai; host encerra para todos.
- Um link só: `/?room=`. `?call=` continua sendo lido.
- Home com Iniciar / Ligar / Entrar. Ligar cria a sala com você de host e convoca a outra pessoa; Entrar junta você à chamada existente.
- Parser de convite aceita chave, URL, query, hash e texto colado com aspas.
- Limite de participantes no host: **5 no free**, **12 no Pro (demo)**. O 6º recebe `room-full` e volta para a home.
- Cabeçalho da chamada mostra `n/máx`.
- Câmera desligada: `replaceTrack(null)`, para o track local (LED apaga) e avisa os outros (`media-meta`). Não envia vídeo preto. Ao religar, pede a câmera de novo.
- Tiles remotos mostram avatar quando a pessoa está sem câmera.

### App, chat e UI

Commits: `5adfeab`, `0da6f4f`, `301199c`, `525ff4f`, `66c11df`, `2fa69fa`, `f8424ba`, `bdffa0d`, `6e41818`, `b96a39e`, `9974e4e`.

- PWA: manifest, ícones, service worker em produção, botão Instalar e dica no iOS.
- Toasts independentes para eventos da chamada (pessoa não encontrada, sala cheia, host encerrou, etc.).
- Chat com botão de fechar, badge de não lidas e mensagens agrupadas por remetente.
- Prévia local da câmera espelhada; compartilhamento de tela não espelha.
- Sons de toque e de chamada encerrada (com unlock na primeira interação).
- Botões da home com estado desabilitado e tooltip (broker ainda conectando, falta chave).
- Layout de tela compartilhada: pin/foco, lista de outras telas, mostrar/ocultar câmeras.

### i18n e identidade

Commits: `2db48ec`, `3ec626e`, `ab3249e`.

- Português, inglês e espanhol, com seletor de idioma. Francês e italiano entram em Não publicado.
- Identidade com opt-in para lembrar neste navegador. O formato do `peerId` depois virou opaco (ver Não publicado).

### Infra

Commits: `cad373c`, `0d7e722`, `a7eac26`, `1729043`.

- TypeScript 7.0.2.
- Ajustes de Tailwind v4 (`bg-linear-to-t`) e componentes em arrow function.

### MVP inicial

Commit: `06b3e81`.

- Onboarding com nome e chave, chamada P2P (áudio/vídeo + chat), compartilhamento de tela, mesh, tiers de qualidade e UI “Pro em breve”.
