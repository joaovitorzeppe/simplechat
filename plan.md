SimpleChat — chat P2P 100% frontend

Projeto novo em [/Users/joaovitorzeppe/Documents/simplechat](/Users/joaovitorzeppe/Documents/simplechat) (pasta ainda não existe). Stack: Vite + React + TypeScript + Tailwind CSS, PeerJS, IndexedDB.

Respostas às suas perguntas

Limitar bitrate/resolução com paywall: sim. No cliente dá para travar qualidade de verdade:

getUserMedia / getDisplayMedia com width, height, frameRate

RTCRtpSender.setParameters({ encodings: [{ maxBitrate }] }) depois da conexão

Isso vira um QualityTier (free vs pro). Exemplo de política:

Free: 640×480 @ 15 fps, ~400 kbps câmera, ~800 kbps tela

Pro: 1280×720 @ 30 fps, ~2.5 Mbps câmera, ~4 Mbps tela

Porém: num app só frontend, qualquer paywall é burável (o JS roda no navegador). Para cobrar de verdade no futuro, o limite técnico continua no cliente, mas a autorização precisa vir de fora (Stripe/Lemon Squeezy + Firebase/Supabase guardando “assinante”). No MVP: tiers no código, UI “Pro em breve”, flag local só para demonstrar a diferença de qualidade — sem pagamento ainda.

Conta Google + histórico em qualquer lugar: sim, como fase 2 (BaaS, sem API própria). O caminho mais alinhado com “sem backend nosso” é Firebase Auth (Google) + Firestore. O histórico local (IndexedDB) permanece como modo anônimo. Não entra no MVP.

Limitação honesta do “100% frontend”

WebRTC sempre precisa de:

Sinalização para trocar oferta/ICE (vamos usar o broker gratuito do PeerJS, 0.peerjs.com)

STUN (ex.: stun.l.google.com) para achar o IP público

TURN em alguns NATs/firewalls corporativos — sem TURN, uma fatia dos usuários não conecta. No MVP: só STUN + PeerJS. TURN (Metered/Open Relay ou coturn) fica documentado como evolução

Áudio/vídeo não passam pelo nosso servidor: vão P2P (ou pelo TURN, se um dia existir).

Salas em mesh (todo mundo envia para todo mundo) funcionam bem com até ~4 pessoas em vídeo. Acima disso o notebook derrete; grupo grande exigiria SFU (LiveKit/mediasoup) e deixaria de ser P2P puro.

Arquitetura

flowchart LR
UserA[Navegador A]
UserB[Navegador B]
Broker[PeerJS Cloud signaling]
Stun[STUN Google]
IDB[IndexedDB local]

UserA -->|"UUID + nome"| Broker
UserB -->|"UUID + nome"| Broker
Broker -.->|"só sinalização"| UserA
Broker -.->|"só sinalização"| UserB
UserA <-->|"áudio vídeo tela chat"| UserB
UserA --> Stun
UserB --> Stun
UserA --> IDB

Identidade: ao entrar, o usuário informa o nome. O app gera crypto.randomUUID(), persiste { displayName, peerId } no localStorage e abre new Peer(peerId). A chave é o próprio ID PeerJS — copiar/colar ou link ?call=<uuid>.

1:1: o outro cola a chave e clica Ligar → peer.call(id, stream) + peer.connect(id) para chat/metadados.

Sala: o host gera outro UUID de sala. Quem entra conecta no host (data channel join). O host envia a lista de peers; cada um monta mesh de mídia com os demais. Se o host sair, a sala encerra (MVP).

Fluxo da UI

Onboarding: nome → gera chave → tela inicial

Home: minha chave (copiar), colar chave de alguém, criar/entrar em sala, histórico (se opt-in)

Chamada: tiles de vídeo, mute, câmera, compartilhar tela (getDisplayMedia + replaceTrack ou tile extra), encerrar

Chat de texto na chamada (data channel)

Histórico: botão do tipo “Salvar histórico neste navegador”, com aviso claro de que não sincroniza, some se limpar dados do site, e não vai para outro device. Sem opt-in, não grava mensagens/chamadas

Bibliotecas

peerjs — IDs customizados, call + data connection

dexie — IndexedDB tipado para histórico

Tailwind CSS v4 via plugin oficial do Vite (@tailwindcss/vite) — UI escura, focada na chamada (onboarding, home, tiles de vídeo, controles, chat, histórico)

No scaffold: npm create vite@latest (React + TS) + instalar tailwindcss e @tailwindcss/vite, registrar o plugin em vite.config.ts e @import "tailwindcss" no CSS de entrada.

README

Único .md do repositório: [README.md](/Users/joaovitorzeppe/Documents/simplechat/README.md), escrito em português.

Conteúdo (este plano, na ordem):

O que é o SimpleChat

Stack e como rodar (npm i / npm run dev)

Como funciona (identidade UUID, 1:1, salas mesh)

Limitações (sinalização PeerJS, STUN, mesh ~4 pessoas, sem TURN no MVP)

Qualidade free/pro e paywall futuro

Fase 2 (Google + Firestore, Stripe, TURN, SFU)

Histórico — seção de changelog no final, preenchida depois de cada entrega (não no scaffold vazio). Formato: data + o que entrou (ex.: onboarding, chamada 1:1, tela, salas, histórico local, tiers)

Nenhum outro arquivo .md no repo.

Qualidade / paywall (gancho agora)

Módulo quality.ts:

getMediaConstraints(tier)

applySenderLimits(sender, tier)

currentTier() lê flag (hoje sempre free, ou toggle interno de demo)

A UI pode mostrar um selo “qualidade gratuita” e um CTA “Pro em breve”. Isso evita refatorar WebRTC quando o pagamento existir.

Fase 2 (fora deste plano)

Firebase Auth Google + Firestore para histórico na nuvem

Stripe/Lemon + custom claim pro para liberar o tier

TURN para NAT difícil

SFU se salas > 4–6 pessoas

Ordem de implementação

Scaffold Vite React TS + Tailwind em Documents/simplechat (create_project + move_agent_to_root)

Identidade, persistência local, tela de nome/chave

Serviço WebRTC (PeerJS): 1:1 áudio/vídeo + data channel

Compartilhamento de tela

Salas mesh (host coordena)

Histórico IndexedDB com opt-in e copy de aviso

Tiers de qualidade + UI “Pro em breve”

README.md com o plano; seção Histórico atualizada por último com o que foi entregue
