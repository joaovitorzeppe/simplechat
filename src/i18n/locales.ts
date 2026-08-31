export const pt = {
  "meta.description":
    "SimpleChat — chamada de áudio, vídeo e chat P2P no navegador.",
  "language.label": "Idioma",
  "language.pt": "Português",
  "language.en": "English",
  "language.es": "Español",

  "common.you": "Você",
  "common.someone": "Alguém",
  "common.youSuffix": " (você)",
  "common.screen": "tela",

  "onboarding.title": "Como você quer aparecer?",
  "onboarding.subtitle":
    "Sem conta e sem servidor nosso. Se você não pedir para lembrar, geramos uma chave nova a cada visita.",
  "onboarding.name": "Nome",
  "onboarding.namePlaceholder": "ex.: Ana",
  "onboarding.rememberTitle": "Lembrar quem eu sou",
  "onboarding.rememberBody":
    "Guardamos seu nome e a chave neste navegador para a próxima visita. Sem isso, uma nova chave é gerada ao entrar.",
  "onboarding.historyTitle": "Salvar histórico neste navegador",
  "onboarding.historyBody":
    "O histórico fica só aqui, não sincroniza e some se limpar os dados do site. Só pode ser ligado se você lembrar quem é, porque ele fica atrelado a esta identidade.",
  "onboarding.enter": "Entrar",

  "home.hello": "Olá, {name}",
  "home.ready": "Pronto para ligar.",
  "home.connecting": "Conectando ao broker PeerJS…",
  "home.history": "Histórico",
  "home.switchIdentity": "Trocar identidade",
  "home.yourKey": "Sua chave",
  "home.callLink": "Link para te ligarem",
  "home.directTitle": "Chamada 1:1",
  "home.directBody":
    "Cole a chave ou o link da pessoa e ligue.",
  "home.peerPlaceholder": "chave ou link (?call=)",
  "home.call": "Ligar",
  "home.roomTitle": "Sala (mesh)",
  "home.roomBody":
    "Você vira o host. Quem entra cola a sua chave ou o link da sala. Se o host sair, a sala acaba.",
  "home.createRoom": "Criar sala",
  "home.roomLink": "Link da sua sala",
  "home.hostPlaceholder": "chave ou link (?room=)",
  "home.joinRoom": "Entrar em sala",
  "home.disabledConnecting":
    "Ainda conectando ao broker. Espere alguns segundos.",
  "home.disabledNeedCall": "Cole a chave ou o link da pessoa.",
  "home.disabledNeedRoom": "Cole a chave ou o link da sala.",
  "home.install": "Instalar app",
  "home.installIos":
    "No Safari: toque em Compartilhar e depois em Adicionar à Tela de Início.",
  "home.simulatePro": "Simular Pro (só neste navegador)",

  "history.title": "Histórico",
  "history.back": "Voltar",
  "history.saveTitle": "Salvar histórico neste navegador",
  "history.saveBody":
    "O histórico fica só neste navegador. Não sincroniza com a nuvem, some se você limpar os dados do site e não aparece em outro dispositivo. Sem este opt-in, o SimpleChat não grava mensagens nem chamadas.",
  "history.saveNeedRemember":
    " Para ligar, volte e entre com “Lembrar quem eu sou” marcado.",
  "history.clear": "Apagar histórico local",
  "history.empty": "Nenhuma chamada salva neste navegador.",
  "history.room": "Sala",
  "history.direct": "1:1",
  "history.noMessages": "Sem mensagens.",

  "call.roomHost": "Sala · você é o host",
  "call.room": "Sala",
  "call.direct": "Chamada 1:1",
  "call.connecting": "Conectando…",
  "call.inCall": "{count} na chamada",
  "call.copyRoomInvite": "Copiar convite da sala",
  "call.copyInvite": "Copiar convite",
  "call.hideCameras": "Ocultar câmeras",
  "call.showCameras": "Mostrar câmeras",
  "call.cameras": "Câmeras",
  "call.unmute": "Ativar microfone",
  "call.mute": "Silenciar",
  "call.cameraOn": "Ligar câmera",
  "call.cameraOff": "Desligar câmera",
  "call.shareScreen": "Compartilhar tela",
  "call.chat": "Chat",
  "call.pinScreen": "Centralizar esta tela",

  "chat.title": "Chat",
  "chat.close": "Fechar chat",
  "chat.empty": "Mensagens desta chamada. Sem opt-in, nada é gravado.",
  "chat.placeholder": "Escreva uma mensagem",
  "chat.send": "Enviar",

  "incoming.title": "Chamada recebida",
  "incoming.body": "Áudio, vídeo e chat P2P.",
  "incoming.reject": "Recusar",
  "incoming.accept": "Atender",

  "quality.pro": "Qualidade Pro (demo)",
  "quality.free": "Qualidade gratuita",
  "quality.proSoon": "Pro em breve — 720p e mais bitrate",

  "error.unavailableId":
    "Esta chave ainda está ocupada no broker. Recarregue em alguns segundos.",
  "error.peerjs": "Falha no PeerJS",
  "toast.peerUnavailable": "Pessoa não encontrada. Confira a chave.",
  "toast.mediaCall": "Permita câmera e microfone para ligar.",
  "toast.mediaRoom": "Permita câmera e microfone para criar a sala.",
  "toast.mediaJoin": "Permita câmera e microfone para entrar na sala.",
  "toast.mediaAccept": "Permita câmera e microfone para atender.",
  "toast.roomEndedByHost": "A sala foi encerrada pelo host.",
  "toast.peerLeft": "A outra pessoa encerrou a chamada.",
  "toast.roomEnded": "A sala acabou.",
  "toast.callEnded": "Chamada encerrada.",
} as const;

export type MessageKey = keyof typeof pt;
export type Messages = Record<MessageKey, string>;

export const en: Messages = {
  "meta.description": "SimpleChat — audio, video and P2P chat in the browser.",
  "language.label": "Language",
  "language.pt": "Português",
  "language.en": "English",
  "language.es": "Español",

  "common.you": "You",
  "common.someone": "Someone",
  "common.youSuffix": " (you)",
  "common.screen": "screen",

  "onboarding.title": "How do you want to appear?",
  "onboarding.subtitle":
    "No account and no server of ours. If you don’t ask us to remember you, we generate a new key on every visit.",
  "onboarding.name": "Name",
  "onboarding.namePlaceholder": "e.g. Ana",
  "onboarding.rememberTitle": "Remember who I am",
  "onboarding.rememberBody":
    "We store your name and key in this browser for the next visit. Otherwise, a new key is generated when you enter.",
  "onboarding.historyTitle": "Save history in this browser",
  "onboarding.historyBody":
    "History stays only here, does not sync, and is gone if you clear site data. It can only be enabled if you remember who you are, because it is tied to this identity.",
  "onboarding.enter": "Enter",

  "home.hello": "Hi, {name}",
  "home.ready": "Ready to call.",
  "home.connecting": "Connecting to the PeerJS broker…",
  "home.history": "History",
  "home.switchIdentity": "Switch identity",
  "home.yourKey": "Your key",
  "home.callLink": "Link for others to call you",
  "home.directTitle": "1:1 call",
  "home.directBody": "Paste someone’s key or link and call.",
  "home.peerPlaceholder": "key or link (?call=)",
  "home.call": "Call",
  "home.roomTitle": "Room (mesh)",
  "home.roomBody":
    "You become the host. Others paste your key or the room link. If the host leaves, the room ends.",
  "home.createRoom": "Create room",
  "home.roomLink": "Your room link",
  "home.hostPlaceholder": "key or link (?room=)",
  "home.joinRoom": "Join room",
  "home.disabledConnecting":
    "Still connecting to the broker. Wait a few seconds.",
  "home.disabledNeedCall": "Paste the person’s key or link.",
  "home.disabledNeedRoom": "Paste the room key or link.",
  "home.install": "Install app",
  "home.installIos":
    "In Safari: tap Share, then Add to Home Screen.",
  "home.simulatePro": "Simulate Pro (this browser only)",

  "history.title": "History",
  "history.back": "Back",
  "history.saveTitle": "Save history in this browser",
  "history.saveBody":
    "History stays only in this browser. It does not sync to the cloud, disappears if you clear site data, and will not show up on another device. Without this opt-in, SimpleChat does not save messages or calls.",
  "history.saveNeedRemember":
    " To enable it, go back and enter with “Remember who I am” checked.",
  "history.clear": "Delete local history",
  "history.empty": "No calls saved in this browser.",
  "history.room": "Room",
  "history.direct": "1:1",
  "history.noMessages": "No messages.",

  "call.roomHost": "Room · you are the host",
  "call.room": "Room",
  "call.direct": "1:1 call",
  "call.connecting": "Connecting…",
  "call.inCall": "{count} in the call",
  "call.copyRoomInvite": "Copy room invite",
  "call.copyInvite": "Copy invite",
  "call.hideCameras": "Hide cameras",
  "call.showCameras": "Show cameras",
  "call.cameras": "Cameras",
  "call.unmute": "Unmute",
  "call.mute": "Mute",
  "call.cameraOn": "Turn camera on",
  "call.cameraOff": "Turn camera off",
  "call.shareScreen": "Share screen",
  "call.chat": "Chat",
  "call.pinScreen": "Focus this screen",

  "chat.title": "Chat",
  "chat.close": "Close chat",
  "chat.empty": "Messages from this call. Without opt-in, nothing is saved.",
  "chat.placeholder": "Write a message",
  "chat.send": "Send",

  "incoming.title": "Incoming call",
  "incoming.body": "Audio, video and P2P chat.",
  "incoming.reject": "Decline",
  "incoming.accept": "Answer",

  "quality.pro": "Pro quality (demo)",
  "quality.free": "Free quality",
  "quality.proSoon": "Pro coming soon — 720p and higher bitrate",

  "error.unavailableId":
    "This key is still taken on the broker. Reload in a few seconds.",
  "error.peerjs": "PeerJS failed",
  "toast.peerUnavailable": "Person not found. Check the key.",
  "toast.mediaCall": "Allow camera and microphone to call.",
  "toast.mediaRoom": "Allow camera and microphone to create a room.",
  "toast.mediaJoin": "Allow camera and microphone to join the room.",
  "toast.mediaAccept": "Allow camera and microphone to answer.",
  "toast.roomEndedByHost": "The host ended the room.",
  "toast.peerLeft": "The other person ended the call.",
  "toast.roomEnded": "The room ended.",
  "toast.callEnded": "Call ended.",
};

export const es: Messages = {
  "meta.description":
    "SimpleChat — llamada de audio, vídeo y chat P2P en el navegador.",
  "language.label": "Idioma",
  "language.pt": "Português",
  "language.en": "English",
  "language.es": "Español",

  "common.you": "Tú",
  "common.someone": "Alguien",
  "common.youSuffix": " (tú)",
  "common.screen": "pantalla",

  "onboarding.title": "¿Cómo quieres aparecer?",
  "onboarding.subtitle":
    "Sin cuenta y sin servidor nuestro. Si no pides que te recordemos, generamos una clave nueva en cada visita.",
  "onboarding.name": "Nombre",
  "onboarding.namePlaceholder": "ej.: Ana",
  "onboarding.rememberTitle": "Recordar quién soy",
  "onboarding.rememberBody":
    "Guardamos tu nombre y la clave en este navegador para la próxima visita. Si no, se genera una clave nueva al entrar.",
  "onboarding.historyTitle": "Guardar historial en este navegador",
  "onboarding.historyBody":
    "El historial queda solo aquí, no se sincroniza y desaparece si se borran los datos del sitio. Solo se puede activar si recuerdas quién eres, porque va ligado a esta identidad.",
  "onboarding.enter": "Entrar",

  "home.hello": "Hola, {name}",
  "home.ready": "Listo para llamar.",
  "home.connecting": "Conectando al broker de PeerJS…",
  "home.history": "Historial",
  "home.switchIdentity": "Cambiar identidad",
  "home.yourKey": "Tu clave",
  "home.callLink": "Enlace para que te llamen",
  "home.directTitle": "Llamada 1:1",
  "home.directBody":
    "Pega la clave o el enlace de la persona y llama.",
  "home.peerPlaceholder": "clave o enlace (?call=)",
  "home.call": "Llamar",
  "home.roomTitle": "Sala (mesh)",
  "home.roomBody":
    "Tú eres el anfitrión. Quien entra pega tu clave o el enlace de la sala. Si el anfitrión sale, la sala termina.",
  "home.createRoom": "Crear sala",
  "home.roomLink": "Enlace de tu sala",
  "home.hostPlaceholder": "clave o enlace (?room=)",
  "home.joinRoom": "Entrar a la sala",
  "home.disabledConnecting":
    "Aún conectando al broker. Espera unos segundos.",
  "home.disabledNeedCall": "Pega la clave o el enlace de la persona.",
  "home.disabledNeedRoom": "Pega la clave o el enlace de la sala.",
  "home.install": "Instalar app",
  "home.installIos":
    "En Safari: toca Compartir y luego Añadir a pantalla de inicio.",
  "home.simulatePro": "Simular Pro (solo en este navegador)",

  "history.title": "Historial",
  "history.back": "Volver",
  "history.saveTitle": "Guardar historial en este navegador",
  "history.saveBody":
    "El historial queda solo en este navegador. No se sincroniza con la nube, desaparece si borras los datos del sitio y no aparece en otro dispositivo. Sin esta opción, SimpleChat no guarda mensajes ni llamadas.",
  "history.saveNeedRemember":
    " Para activarlo, vuelve y entra con “Recordar quién soy” marcado.",
  "history.clear": "Borrar historial local",
  "history.empty": "No hay llamadas guardadas en este navegador.",
  "history.room": "Sala",
  "history.direct": "1:1",
  "history.noMessages": "Sin mensajes.",

  "call.roomHost": "Sala · eres el anfitrión",
  "call.room": "Sala",
  "call.direct": "Llamada 1:1",
  "call.connecting": "Conectando…",
  "call.inCall": "{count} en la llamada",
  "call.copyRoomInvite": "Copiar invitación de la sala",
  "call.copyInvite": "Copiar invitación",
  "call.hideCameras": "Ocultar cámaras",
  "call.showCameras": "Mostrar cámaras",
  "call.cameras": "Cámaras",
  "call.unmute": "Activar micrófono",
  "call.mute": "Silenciar",
  "call.cameraOn": "Encender cámara",
  "call.cameraOff": "Apagar cámara",
  "call.shareScreen": "Compartir pantalla",
  "call.chat": "Chat",
  "call.pinScreen": "Centrar esta pantalla",

  "chat.title": "Chat",
  "chat.close": "Cerrar chat",
  "chat.empty": "Mensajes de esta llamada. Sin la opción, no se guarda nada.",
  "chat.placeholder": "Escribe un mensaje",
  "chat.send": "Enviar",

  "incoming.title": "Llamada entrante",
  "incoming.body": "Audio, vídeo y chat P2P.",
  "incoming.reject": "Rechazar",
  "incoming.accept": "Contestar",

  "quality.pro": "Calidad Pro (demo)",
  "quality.free": "Calidad gratuita",
  "quality.proSoon": "Pro pronto — 720p y más bitrate",

  "error.unavailableId":
    "Esta clave sigue ocupada en el broker. Recarga en unos segundos.",
  "error.peerjs": "Fallo de PeerJS",
  "toast.peerUnavailable": "Persona no encontrada. Revisa la clave.",
  "toast.mediaCall": "Permite la cámara y el micrófono para llamar.",
  "toast.mediaRoom": "Permite la cámara y el micrófono para crear la sala.",
  "toast.mediaJoin": "Permite la cámara y el micrófono para entrar a la sala.",
  "toast.mediaAccept": "Permite la cámara y el micrófono para contestar.",
  "toast.roomEndedByHost": "El anfitrión cerró la sala.",
  "toast.peerLeft": "La otra persona terminó la llamada.",
  "toast.roomEnded": "La sala terminó.",
  "toast.callEnded": "Llamada finalizada.",
};

export const dictionaries: Record<"pt" | "en" | "es", Messages> = {
  pt,
  en,
  es,
};
