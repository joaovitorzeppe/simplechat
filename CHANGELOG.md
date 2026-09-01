# Changelog

Histórico do SimpleChat, agrupado a partir dos commits do git. O mais recente vem primeiro.

O formato segue a ideia de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

Tudo o que entrou depois do primeiro CHANGELOG, ainda neste dia.

### Sala, convite e host

Commits: `845b1ee`, `01ca868`, `a56b288`.

- Convite com segredo no fragmento: `/?room=<chave>#k=<segredo>`. Sem o `#k=` certo, o pedido nem chega ao host. Recusar ou remover alguém gira o segredo; o link antigo deixa de valer.
- Quem abre o convite sem identidade passa pelo onboarding e, com o broker pronto, entra na sala sozinho — não precisa clicar em Entrar na home.
- Sala de espera: quem entra fica no lobby até o host aprovar. Quem o host discou (Ligar) entra direto.
- Host pode recusar a entrada e remover alguém da chamada. Recusado e removido ficam bloqueados por `peerId`.
- Host que sai escolhe passar o papel (`host-transfer`) ou encerrar para todos. Se o host some sem avisar, o menor `peerId` entre quem ficou assume; sobrando uma pessoa, a chamada acaba.
- Ligar no link de uma chamada já aberta entra como convidado. Não rouba o host nem encerra a sala ao sair.

### Chat, arquivos, menções e recents

Commits: `872b2f8`, `395ac4c`, `2732ee2`, `1f4e155`.

- Links no chat viram texto clicável. Antes de abrir, um aviso mostra o endereço com Cancelar ou Abrir em nova aba.
- Arquivos no chat via data channel P2P. **Só o plano Pro envia** (teto 100 MB). O free ainda recebe. Preview de jpeg/png/gif/webp; o resto só baixa. Some ao sair da chamada.
- Leitura e montagem das fatias no worker (fallback na UI). Com OPFS, os bytes recebidos vão para o disco do origin durante a transferência.
- Recentes na home: quem já esteve numa chamada com você, para Ligar de novo (não reabre a sala antiga).
- Quando alguém sai, os outros veem toast e uma linha no chat com o nome.
- Menções no chat: `@` depois de espaço abre o seletor (roster + `@all`). O fio leva `peerId` (ou `"all"`), não o nome. E-mails não disparam o picker. Quem foi marcado vê a bolha em destaque e um toast; quem enviou, não.

### Silenciar áudio e vídeo

- Qualquer participante pode desligar o áudio ou o vídeo de outra pessoa **só para si** (não vai para o fio). O host não é alvo: não há controle no tile dele, e `room-mute` apontando para o host é ignorado.
- O host pode silenciar para si ou para a **sala inteira**. Mute de sala chega por `room-mute` (só o host) e no snapshot de `room-peers` para quem entra depois. Quem foi silenciado na sala não religa mic/câmera até o host liberar; os outros também não reativam para si.
- Ao liberar, mic e câmera da pessoa **não voltam sozinhos** — ela religa se quiser.

### Entrada sem câmera ou microfone

- Criar sala, entrar, ligar ou atender não exige mais os dois dispositivos. A cascata tenta áudio+vídeo, depois só áudio, só vídeo, e por fim entra só ouvindo (chat + receber mídia dos outros).
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
- TURN opcional por `VITE_TURN_URL`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL`. Sem as três, segue só STUN.
- Vitest (`npm test`); testes em `tests/` (wire, convite, identidade, arquivo, recents, chat, menções, mute, mídia, sessão, texto).
- Removido `@vercel/speed-insights`.

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

- Português, inglês e espanhol, com seletor de idioma.
- Identidade com opt-in para lembrar neste navegador. O formato do `peerId` depois virou opaco (ver Não publicado).

### Infra

Commits: `cad373c`, `0d7e722`, `a7eac26`, `1729043`.

- TypeScript 7.0.2.
- Ajustes de Tailwind v4 (`bg-linear-to-t`) e componentes em arrow function.

### MVP inicial

Commit: `06b3e81`.

- Onboarding com nome e chave, chamada P2P (áudio/vídeo + chat), compartilhamento de tela, mesh, tiers de qualidade e UI “Pro em breve”.
