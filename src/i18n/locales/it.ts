import type { Messages } from "./pt";

export const it: Messages = {
  "meta.description":
    "SimpleChat — chiamata audio, video e chat P2P nel browser.",
  "language.label": "Lingua",
  "language.pt": "Português",
  "language.en": "English",
  "language.es": "Español",
  "language.fr": "Français",
  "language.it": "Italiano",

  "common.you": "Tu",
  "common.someone": "Qualcuno",
  "common.youSuffix": " (tu)",
  "common.screen": "schermo",
  "common.loading": "Caricamento…",

  "onboarding.title": "Come vuoi apparire?",
  "onboarding.subtitle":
    "Niente account e niente server nostro. Se non chiedi di essere ricordato, generiamo una nuova chiave a ogni visita.",
  "onboarding.inviteSubtitle":
    "Hai un invito. Dopo il nome, entriamo nella chiamata.",
  "onboarding.name": "Nome",
  "onboarding.namePlaceholder": "es.: Ana",
  "onboarding.rememberTitle": "Ricorda chi sono",
  "onboarding.rememberBody":
    "Salviamo il tuo nome e la chiave in questo browser per la prossima visita. Altrimenti, una nuova chiave viene generata all’ingresso.",
  "onboarding.enter": "Entra",

  "home.hello": "Ciao, {name}",
  "home.ready": "Pronto a chiamare.",
  "home.connecting": "Connessione al broker PeerJS…",
  "home.switchIdentity": "Cambia identità",
  "home.yourKey": "La tua chiave",
  "home.inviteLink": "Link della tua chiamata",
  "home.copy": "Copia",
  "home.inviteBody":
    "Avvia una chiamata e condividi il link. Sei l’host: approvi chi entra, puoi rimuovere qualcuno e, uscendo, scegli se passare l’host o chiudere per tutti.",
  "home.startCall": "Avvia chiamata",
  "home.joinTitle": "Entra o chiama",
  "home.joinBody":
    "Chiama avvisa chi non è ancora in una chiamata: sei tu l’host. Se ha già iniziato, Chiama entra come ospite. Entra ti unisce a una chiamata già avviata.",
  "home.invitePlaceholder": "chiave o link (?room=)",
  "home.call": "Chiama",
  "home.join": "Entra",
  "home.disabledConnecting":
    "Ancora in connessione al broker. Aspetta qualche secondo.",
  "home.disabledNeedInvite": "Incolla la chiave o il link della chiamata.",
  "home.install": "Installa app",
  "home.installIos":
    "In Safari: tocca Condividi e poi Aggiungi a Home.",
  "home.simulatePro": "Simula Pro (solo in questo browser)",
  "home.recentsTitle": "Recenti",
  "home.recentsBody":
    "Persone con cui sei già stato in una chiamata. Chiama le avvisa di nuovo; un invito vecchio non riapre la stanza.",
  "home.recentsCall": "Chiama",
  "home.recentsForget": "Dimentica",

  "call.host": "Chiamata · sei l’host",
  "call.guest": "Chiamata",
  "call.connecting": "Connessione…",
  "call.networkHint":
    "Questa rete potrebbe bloccare la chiamata P2P. Passa dal Wi‑Fi ai dati mobili (o il contrario) e riprova.",
  "call.inCall": "{count}/{max} nella chiamata",
  "call.copyInvite": "Copia invito",
  "call.endForEveryone": "Termina per tutti",
  "call.leave": "Esci dalla chiamata",
  "call.hideCameras": "Nascondi telecamere",
  "call.showCameras": "Mostra telecamere",
  "call.cameras": "Telecamere",
  "call.unmute": "Attiva microfono",
  "call.mute": "Disattiva microfono",
  "call.cameraOn": "Accendi fotocamera",
  "call.cameraOff": "Spegni fotocamera",
  "call.shareScreen": "Condividi schermo",
  "call.chat": "Chat",
  "call.pinScreen": "Centra questo schermo",
  "call.waiting": "In attesa che l’host ti faccia entrare…",
  "call.remove": "Rimuovi dalla chiamata",
  "call.muteForMe": "Silenzia per me",
  "call.unmuteForMe": "Attiva audio per me",
  "call.muteForRoom": "Silenzia per la stanza",
  "call.unmuteForRoom": "Consenti il microfono nella stanza",
  "call.muteVideoForMe": "Spegni video per me",
  "call.unmuteVideoForMe": "Attiva video per me",
  "call.muteVideoForRoom": "Spegni video per la stanza",
  "call.unmuteVideoForRoom": "Consenti il video nella stanza",
  "call.muteAudioOptions": "Audio di questo partecipante",
  "call.muteVideoOptions": "Video di questo partecipante",
  "call.hostMutedAudio": "L’host ha disattivato il microfono nella stanza",
  "call.hostMutedVideo": "L’host ha spento la fotocamera nella stanza",
  "call.hostMutedYouAudio": "L’host ha disattivato il tuo microfono",
  "call.hostMutedYouVideo": "L’host ha spento la tua fotocamera",

  "lobby.title": "Vogliono entrare",
  "lobby.body": "Entra solo chi approvi tu.",
  "lobby.admit": "Accetta",
  "lobby.deny": "Rifiuta",

  "hostLeave.title": "Sei l’host di questa chiamata",
  "hostLeave.body":
    "Se termini, la chiamata finisce per tutti. Puoi anche passare l’host a un’altra persona e la stanza continua senza di te.",
  "hostLeave.transfer": "Passa l’host ed esci",
  "hostLeave.end": "Termina per tutti",
  "hostLeave.cancel": "Resta nella chiamata",

  "chat.title": "Chat",
  "chat.close": "Chiudi chat",
  "chat.empty": "Messaggi di questa chiamata. Scompaiono quando finisce.",
  "chat.placeholder": "Scrivi un messaggio",
  "chat.send": "Invia",
  "chat.linkWarningKicker": "Link esterno",
  "chat.linkWarningTitle": "Questo link potrebbe essere pericoloso",
  "chat.linkWarningBody":
    "Potrebbe portare a un sito falso o dannoso. Controlla l’indirizzo prima di aprire.",
  "chat.linkCancel": "Annulla",
  "chat.linkOpen": "Apri comunque",
  "chat.attach": "Invia file",
  "chat.attachPro": "Inviare file è una funzione Pro",
  "chat.download": "Scarica",
  "chat.fileSending": "Invio…",
  "chat.fileReceiving": "Ricezione…",
  "chat.fileError": "Errore nel file",
  "chat.mentionAll": "Tutti nella chiamata",
  "chat.mentionPicker": "Menziona qualcuno",

  "incoming.title": "Chiamata in arrivo",
  "incoming.body": "Audio, video e chat P2P.",
  "incoming.reject": "Rifiuta",
  "incoming.accept": "Rispondi",

  "quality.pro": "Qualità Pro (demo)",
  "quality.free": "Qualità gratuita",
  "quality.proSoon":
    "Pro in arrivo — 720p, file in chat e più bitrate",

  "error.unavailableId":
    "Questa chiave è ancora occupata sul broker. Ricarica tra qualche secondo.",
  "error.peerjs": "Errore di PeerJS",
  "error.crashTitle": "Qualcosa si è rotto qui",
  "error.crashBody":
    "Lo schermo si è bloccato per un errore inatteso. Ricaricare di solito risolve; dovrai rifare la chiamata.",
  "error.crashReload": "Ricarica",
  "error.insecureContext":
    "Apri in HTTPS o localhost. Fotocamera e microfono non funzionano su questa origine.",
  "toast.networkPath":
    "Impossibile connettersi su questa rete. Passa dal Wi‑Fi ai dati mobili (o il contrario) e riprova — alcune reti bloccano le chiamate P2P.",
  "toast.networkPathPeer":
    "Impossibile raggiungere {name} su questa rete. Passa dal Wi‑Fi ai dati mobili (o il contrario).",
  "toast.peerUnavailable": "Persona non trovata. Controlla la chiave.",
  "toast.mediaCall": "Consenti fotocamera e microfono per chiamare.",
  "toast.mediaRoom": "Consenti fotocamera e microfono per creare la stanza.",
  "toast.mediaJoin": "Consenti fotocamera e microfono per entrare nella stanza.",
  "toast.mediaAccept": "Consenti fotocamera e microfono per rispondere.",
  "toast.roomEndedByHost": "L’host ha terminato la chiamata.",
  "toast.leftCall": "Sei uscito dalla chiamata.",
  "toast.peerLeft": "{name} è uscito dalla chiamata.",
  "toast.mentioned": "{name} ti ha menzionato",
  "toast.mentionedAll": "{name} ha menzionato tutti",
  "toast.callEnded": "Chiamata terminata.",
  "toast.roomFull": "Questa chiamata è piena.",
  "toast.mediaCamera": "Consenti la fotocamera per accenderla.",
  "toast.mediaMic": "Consenti il microfono per attivarlo.",
  "toast.mediaAudioOnly":
    "Sei entrato solo con l’audio. Puoi accendere la fotocamera dopo.",
  "toast.mediaVideoOnly":
    "Sei entrato senza microfono. Puoi attivarlo dopo.",
  "toast.mediaListenOnly":
    "Sei entrato senza fotocamera né microfono. Puoi ascoltare e usare la chat.",
  "toast.fileTooBig": "File sopra i {max} MB.",
  "toast.fileTooBigPro": "File sopra i 100 MB (piano Pro).",
  "toast.fileProOnly": "Inviare file è una funzione Pro.",
  "toast.fileFailed": "Impossibile inviare o ricevere il file.",
  "toast.fileBusy": "Aspetta che finisca l’invio in corso.",
  "toast.knock": "{name} vuole entrare nella chiamata.",
  "toast.joinDenied": "L’host non ha approvato il tuo ingresso.",
  "toast.inviteStale": "Link non valido o scaduto. Chiedi un nuovo invito.",
  "toast.kicked": "L’host ti ha rimosso dalla chiamata.",
  "toast.removed": "{name} è stato rimosso dalla chiamata.",
  "toast.hostHandedOver": "Hai passato l’host a {name}.",
  "toast.hostLeftYouHost": "L’host è uscito. Ora conduci tu la chiamata.",
  "toast.hostLeftNewHost": "L’host è uscito. Ora {name} conduce la chiamata.",
  "toast.hostDroppedYouHost":
    "L’host ha perso la connessione. Ora conduci tu la chiamata.",
  "toast.hostDroppedNewHost":
    "L’host ha perso la connessione. Ora {name} conduce la chiamata.",
  "toast.hostDroppedAlone":
    "L’host ha perso la connessione e la chiamata è finita.",
  "toast.roomMutedAudio": "L’host ha disattivato il tuo microfono per la stanza.",
  "toast.roomUnmutedAudio": "L’host ha riattivato il tuo microfono.",
  "toast.roomMutedVideo": "L’host ha spento la tua fotocamera per la stanza.",
  "toast.roomUnmutedVideo": "L’host ha riattivato la tua fotocamera.",
};
