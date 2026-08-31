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
  "home.inviteLink": "Link da sua chamada",
  "home.inviteBody":
    "Inicie uma chamada e compartilhe o link. Você é o host: se sair, a chamada acaba para todos. Quem entra só sai da sala.",
  "home.startCall": "Iniciar chamada",
  "home.joinTitle": "Entrar ou ligar",
  "home.joinBody":
    "Ligar cria a chamada com você de host e convoca a outra pessoa. Entrar junta você à chamada que ela já começou.",
  "home.invitePlaceholder": "chave ou link (?room=)",
  "home.call": "Ligar",
  "home.join": "Entrar",
  "home.disabledConnecting":
    "Ainda conectando ao broker. Espere alguns segundos.",
  "home.disabledNeedInvite": "Cole a chave ou o link da chamada.",
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
  "history.call": "Chamada",
  "history.noMessages": "Sem mensagens.",

  "call.host": "Chamada · você é o host",
  "call.guest": "Chamada",
  "call.connecting": "Conectando…",
  "call.inCall": "{count}/{max} na chamada",
  "call.copyInvite": "Copiar convite",
  "call.endForEveryone": "Encerrar para todos",
  "call.leave": "Sair da chamada",
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
  "toast.roomEndedByHost": "O host encerrou a chamada.",
  "toast.leftCall": "Você saiu da chamada.",
  "toast.callEnded": "Chamada encerrada.",
  "toast.roomFull": "Esta chamada está cheia.",
  "toast.mediaCamera": "Permita a câmera para ligá-la.",
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
  "home.inviteLink": "Your call link",
  "home.inviteBody":
    "Start a call and share the link. You are the host: if you leave, the call ends for everyone. Anyone else who hangs up just leaves the room.",
  "home.startCall": "Start call",
  "home.joinTitle": "Join or call",
  "home.joinBody":
    "Call starts a room with you as host and rings the other person. Join puts you in a call they already started.",
  "home.invitePlaceholder": "key or link (?room=)",
  "home.call": "Call",
  "home.join": "Join",
  "home.disabledConnecting":
    "Still connecting to the broker. Wait a few seconds.",
  "home.disabledNeedInvite": "Paste the call key or link.",
  "home.install": "Install app",
  "home.installIos": "In Safari: tap Share, then Add to Home Screen.",
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
  "history.call": "Call",
  "history.noMessages": "No messages.",

  "call.host": "Call · you are the host",
  "call.guest": "Call",
  "call.connecting": "Connecting…",
  "call.inCall": "{count}/{max} in the call",
  "call.copyInvite": "Copy invite",
  "call.endForEveryone": "End for everyone",
  "call.leave": "Leave call",
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
  "toast.roomEndedByHost": "The host ended the call.",
  "toast.leftCall": "You left the call.",
  "toast.callEnded": "Call ended.",
  "toast.roomFull": "This call is full.",
  "toast.mediaCamera": "Allow the camera to turn it on.",
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
  "home.inviteLink": "Enlace de tu llamada",
  "home.inviteBody":
    "Inicia una llamada y comparte el enlace. Eres el anfitrión: si sales, la llamada termina para todos. Quien entra solo sale de la sala.",
  "home.startCall": "Iniciar llamada",
  "home.joinTitle": "Entrar o llamar",
  "home.joinBody":
    "Llamar crea la llamada contigo como anfitrión y avisa a la otra persona. Entrar te une a una llamada que ya empezó.",
  "home.invitePlaceholder": "clave o enlace (?room=)",
  "home.call": "Llamar",
  "home.join": "Entrar",
  "home.disabledConnecting": "Aún conectando al broker. Espera unos segundos.",
  "home.disabledNeedInvite": "Pega la clave o el enlace de la llamada.",
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
  "history.call": "Llamada",
  "history.noMessages": "Sin mensajes.",

  "call.host": "Llamada · eres el anfitrión",
  "call.guest": "Llamada",
  "call.connecting": "Conectando…",
  "call.inCall": "{count}/{max} en la llamada",
  "call.copyInvite": "Copiar invitación",
  "call.endForEveryone": "Terminar para todos",
  "call.leave": "Salir de la llamada",
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
  "toast.roomEndedByHost": "El anfitrión terminó la llamada.",
  "toast.leftCall": "Saliste de la llamada.",
  "toast.callEnded": "Llamada finalizada.",
  "toast.roomFull": "Esta llamada está llena.",
  "toast.mediaCamera": "Permite la cámara para encenderla.",
};

export const dictionaries: Record<"pt" | "en" | "es", Messages> = {
  pt,
  en,
  es,
};
