# Changelog

Histórico do SimpleChat, agrupado a partir dos commits do git. O mais recente vem primeiro.

O formato segue a ideia de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

### Removido

- Histórico local: tela, Dexie/IndexedDB, opt-in no onboarding e gravação de chamadas/mensagens. O chat continua só enquanto a chamada está aberta.

### Adicionado

- Links no chat viram texto clicável. Antes de abrir, um aviso mostra o endereço com Cancelar ou Abrir em nova aba.
- Arquivos no chat via data channel P2P (fatias de 16 KB). Teto de **50 MB no free** e **100 MB no Pro** só no envio. Preview de imagem e download; some ao sair da chamada.

### Corrigido

- Ligar no link de uma chamada já aberta entra como convidado. Não rouba o host nem encerra a sala ao sair.

## [2026-08-31]

Tudo abaixo entrou no mesmo dia, do MVP até a chamada unificada.

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
- Identidade: `peerId` `{primeiroNome}-{uuid}-{timestamp}`. Opt-in para lembrar quem é neste navegador.

### Infra

Commits: `cad373c`, `0d7e722`, `a7eac26`, `1729043`.

- TypeScript 7.0.2.
- Vercel Speed Insights.
- Ajustes de Tailwind v4 (`bg-linear-to-t`) e componentes em arrow function.

### MVP inicial

Commit: `06b3e81`.

- Onboarding com nome e chave, chamada P2P (áudio/vídeo + chat), compartilhamento de tela, mesh, tiers de qualidade e UI “Pro em breve”.
