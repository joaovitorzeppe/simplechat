import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { electHost, PeerSession, type SessionState } from "@libs/session";
import { setDemoTier } from "@libs/quality";
import { getToast } from "@libs/toast";
import type { PeerInfo, RemotePeer, WireMessage } from "@libs/types";

type FakeConn = {
  peer: string;
  open: boolean;
  sent: WireMessage[];
  send: (message: WireMessage) => void;
  close: () => void;
};

type Internals = {
  state: SessionState;
  patch: (partial: Partial<SessionState>) => void;
  onWire: (conn: unknown, raw: unknown) => void;
  onPeerLeft: (peerId: string) => void;
  handleIceGaveUp: (peerId: string) => void;
  failPath: (peerId?: string) => void;
  iceEverConnected: Set<string>;
  names: Map<string, string>;
  roomMembers: PeerInfo[];
  banned: Set<string>;
  hostSecret: string | null;
  data: Map<string, FakeConn>;
  dialedPeerId: string | null;
  incomingFiles: Map<string, unknown>;
};

const internals = (session: PeerSession) => session as unknown as Internals;

const conn = (peer: string): FakeConn => ({
  peer,
  open: true,
  sent: [],
  send(message: WireMessage) {
    this.sent.push(message);
  },
  close: () => {},
});

const remote = (peerId: string, displayName: string): RemotePeer => ({
  peerId,
  displayName,
  stream: null,
  screenStream: null,
  sharingScreen: false,
  cameraOff: false,
});

const HOST = "host-1";
const ME = "me-1";
const INTRUDER = "intruso-1";
/** Ordena depois de ME, então ME vence a eleição entre os dois. */
const ZECA = "zeca-1";
/** Ordena antes de ME, então vence a eleição contra ME. */
const ANA = "ana-1";

const SECRET = "segredo000000001";

const hello = (
  peerId: string,
  displayName: string,
  secret: string | null = SECRET,
) => ({
  type: "hello",
  displayName,
  peerId,
  kind: "room-join",
  ...(secret ? { secret } : {}),
});

let session: PeerSession;
let core: Internals;

/** Coloca a sessão no estado de convidado numa sala conduzida por HOST. */
const asGuest = () => {
  core.patch({
    identity: { peerId: ME, displayName: "Eu" },
    callStatus: "in-call",
    view: "call",
    isHost: false,
    hostPeerId: HOST,
  });
  core.dialedPeerId = HOST;
  core.roomMembers = [
    { peerId: HOST, displayName: "Host" },
    { peerId: ME, displayName: "Eu" },
  ];
};

/** Coloca a sessão como host de uma sala já em andamento. */
const asHost = () => {
  core.patch({
    identity: { peerId: ME, displayName: "Eu" },
    callStatus: "in-call",
    view: "call",
    isHost: true,
    hostPeerId: ME,
    roomSecret: SECRET,
  });
  core.hostSecret = SECRET;
  core.roomMembers = [{ peerId: ME, displayName: "Eu" }];
};

beforeEach(() => {
  session = new PeerSession();
  core = internals(session);
});

describe("autoridade das mensagens de sala", () => {
  it("ignora room-ended vindo de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), { type: "room-ended" });
    expect(core.state.callStatus).toBe("in-call");
  });

  it("aceita room-ended vindo do host", () => {
    asGuest();
    core.onWire(conn(HOST), { type: "room-ended" });
    expect(core.state.callStatus).toBe("idle");
  });

  it("ignora room-full vindo de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), { type: "room-full" });
    expect(core.state.callStatus).toBe("in-call");
  });

  it("ignora room-peers vindo de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), {
      type: "room-peers",
      peers: [{ peerId: "plantado", displayName: "Plantado" }],
    });
    expect(core.state.remotes).toHaveLength(0);
  });

  it("ignora room-host vindo de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), { type: "room-host", hostPeerId: INTRUDER });
    expect(core.state.hostPeerId).toBe(HOST);
  });

  it("não deixa um convidado encerrar a sala do host", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "in-call",
      view: "call",
      isHost: true,
      hostPeerId: ME,
    });
    core.onWire(conn(INTRUDER), { type: "room-ended" });
    expect(core.state.callStatus).toBe("in-call");
  });
});

describe("identidade das mensagens", () => {
  it("usa a conexão como remetente, não o que a mensagem afirma", () => {
    asGuest();
    core.roomMembers = [
      ...core.roomMembers,
      {
        peerId: "bruno-1",
        displayName: "Bruno",
      },
    ];
    core.names.set("bruno-1", "Bruno");
    core.onWire(conn("bruno-1"), {
      type: "chat",
      id: "qualquer",
      text: "transfere o dinheiro",
      fromPeerId: HOST,
      fromName: "Host",
      at: 1700000000000,
    });
    const message = core.state.messages.at(-1);
    expect(message?.fromPeerId).toBe("bruno-1");
    expect(message?.fromName).toBe("Bruno");
    expect(message?.text).toBe("transfere o dinheiro");
  });

  it("guarda menções e ignora ids que não estão na sala", () => {
    asGuest();
    core.names.set("bruno-1", "Bruno");
    core.roomMembers = [
      ...core.roomMembers,
      { peerId: "bruno-1", displayName: "Bruno" },
    ];
    core.onWire(conn("bruno-1"), {
      type: "chat",
      id: "m1",
      text: "oi @Eu",
      fromPeerId: "bruno-1",
      fromName: "Bruno",
      at: 1700000000000,
      mentions: ["me-1", "intruso-1", "all"],
    });
    const message = core.state.messages.at(-1);
    expect(message?.mentions).toEqual(["me-1", "all"]);
  });

  it("não deixa forjar mensagem como se fosse do próprio usuário", () => {
    asGuest();
    core.onWire(conn(INTRUDER), {
      type: "chat",
      id: "qualquer",
      text: "eu concordo",
      fromPeerId: ME,
      fromName: "Eu",
      at: 1700000000000,
    });
    expect(core.state.messages.at(-1)?.fromPeerId).not.toBe(ME);
  });

  it("descarta chat malformado em vez de deixar quebrar o render", () => {
    asGuest();
    core.onWire(conn(HOST), {
      type: "chat",
      id: "x",
      text: { toString: "nope" },
      fromPeerId: HOST,
      fromName: "Host",
      at: 1,
    });
    expect(core.state.messages).toHaveLength(0);
  });

  it("ignora chat quando não há chamada em andamento", () => {
    core.patch({ identity: { peerId: ME, displayName: "Eu" } });
    core.onWire(conn(INTRUDER), {
      type: "chat",
      id: "x",
      text: "oi",
      fromPeerId: INTRUDER,
      fromName: "Intruso",
      at: 1700000000000,
    });
    expect(core.state.messages).toHaveLength(0);
  });
});

describe("recepção de arquivos", () => {
  const fileStart = {
    type: "file-start",
    id: "f1",
    name: "foto.png",
    mime: "image/png",
    size: 1024,
    fromPeerId: HOST,
    fromName: "Host",
    at: 1700000000000,
  };

  it("recusa file-start de peer que não está na sala", () => {
    asGuest();
    core.onWire(conn(INTRUDER), fileStart);
    expect(core.incomingFiles.size).toBe(0);
    expect(core.state.messages).toHaveLength(0);
  });

  it("aceita file-start de quem está na sala", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    expect(core.incomingFiles.size).toBe(1);
    expect(core.state.messages.at(-1)?.file?.name).toBe("foto.png");
  });

  it("aplica cooldown para não permitir enxurrada de file-start", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    for (let i = 0; i < 50; i += 1) {
      core.onWire(conn(HOST), { ...fileStart, id: `f${i}` });
    }
    expect(core.incomingFiles.size).toBe(1);
  });

  it("não confia no id do remetente para identificar a mensagem", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    expect(core.state.messages.at(-1)?.id).not.toBe("f1");
  });
});

describe("eleição de host", () => {
  it("é determinística e igual para todos os peers", () => {
    const pool = [ZECA, ME, ANA];
    expect(electHost(pool)).toBe(ANA);
    expect(electHost(pool.toReversed())).toBe(ANA);
  });

  it("devolve nulo quando não sobra ninguém", () => {
    expect(electHost([])).toBeNull();
  });
});

describe("transferência explícita de host", () => {
  it("aceita host-transfer do host e assume o papel", () => {
    asGuest();
    core.onWire(conn(HOST), { type: "host-transfer", hostPeerId: ME });
    expect(core.state.isHost).toBe(true);
    expect(core.state.hostPeerId).toBe(ME);
  });

  it("aponta para o novo host quando o escolhido é outra pessoa", () => {
    asGuest();
    core.onWire(conn(HOST), { type: "host-transfer", hostPeerId: ZECA });
    expect(core.state.isHost).toBe(false);
    expect(core.state.hostPeerId).toBe(ZECA);
  });

  it("ignora host-transfer de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), {
      type: "host-transfer",
      hostPeerId: INTRUDER,
    });
    expect(core.state.hostPeerId).toBe(HOST);
    expect(core.state.isHost).toBe(false);
  });

  it("deixa de confiar no peer discado depois de virar host", () => {
    asGuest();
    core.onWire(conn(HOST), { type: "host-transfer", hostPeerId: ME });
    core.onWire(conn(HOST), { type: "room-ended" });
    expect(core.state.callStatus).toBe("in-call");
  });
});

describe("queda do host sem aviso", () => {
  it("elege o menor peerId entre quem sobrou", () => {
    asGuest();
    core.roomMembers = [
      { peerId: HOST, displayName: "Host" },
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.patch({ remotes: [remote(HOST, "Host"), remote(ZECA, "Zeca")] });
    core.onPeerLeft(HOST);
    expect(core.state.isHost).toBe(true);
    expect(core.state.hostPeerId).toBe(ME);
    expect(core.state.callStatus).toBe("in-call");
  });

  it("segue como convidado quando outro peer vence a eleição", () => {
    asGuest();
    core.roomMembers = [
      { peerId: HOST, displayName: "Host" },
      { peerId: ME, displayName: "Eu" },
      { peerId: ANA, displayName: "Ana" },
    ];
    core.patch({ remotes: [remote(HOST, "Host"), remote(ANA, "Ana")] });
    core.onPeerLeft(HOST);
    expect(core.state.isHost).toBe(false);
    expect(core.state.hostPeerId).toBe(ANA);
    expect(core.state.callStatus).toBe("in-call");
  });

  it("encerra a chamada quando ninguém mais resta", () => {
    asGuest();
    core.patch({ remotes: [remote(HOST, "Host")] });
    core.onPeerLeft(HOST);
    expect(core.state.callStatus).toBe("idle");
  });

  it("não promove ninguém se a entrada ainda nem foi aprovada", () => {
    asGuest();
    core.patch({ callStatus: "waiting", remotes: [remote(HOST, "Host")] });
    core.onPeerLeft(HOST);
    expect(core.state.callStatus).toBe("idle");
    expect(core.state.isHost).toBe(false);
  });
});

describe("sala de espera", () => {
  it("põe desconhecido na espera em vez de admitir direto", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    expect(core.state.pending).toEqual([{ peerId: ZECA, displayName: "Zeca" }]);
    expect(core.state.remotes).toHaveLength(0);
    expect(core.roomMembers).toHaveLength(1);
    expect(c.sent).toContainEqual({ type: "room-waiting" });
  });

  it("ignora o que a pessoa na espera manda antes da decisão", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    core.onWire(c, {
      type: "chat",
      id: "x",
      text: "deixa eu entrar",
      fromPeerId: ZECA,
      fromName: "Zeca",
      at: 1700000000000,
    });
    expect(core.state.messages).toHaveLength(0);
  });

  it("admite quem o host aprova", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    session.admitPeer(ZECA);
    expect(core.state.pending).toHaveLength(0);
    expect(core.roomMembers).toContainEqual({
      peerId: ZECA,
      displayName: "Zeca",
    });
    expect(core.state.remotes.map((r) => r.peerId)).toContain(ZECA);
  });

  it("recusado não consegue bater na porta de novo", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    session.denyPeer(ZECA);
    expect(core.state.pending).toHaveLength(0);
    expect(c.sent).toContainEqual({ type: "room-denied" });

    const retry = conn(ZECA);
    core.data.set(ZECA, retry);
    core.onWire(retry, hello(ZECA, "Zeca"));
    expect(core.state.pending).toHaveLength(0);
    expect(retry.sent).toContainEqual({ type: "room-denied" });
  });

  it("recusa quem chega sem o segredo do link", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca", null));
    expect(core.state.pending).toHaveLength(0);
    expect(c.sent).toContainEqual({ type: "room-denied", reason: "stale" });
  });

  it("recusa quem chega com o segredo errado", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca", "chutedoerrado0001"));
    expect(core.state.pending).toHaveLength(0);
    expect(c.sent).toContainEqual({ type: "room-denied", reason: "stale" });
  });

  it("convidado distingue link velho de recusa do host", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "connecting",
      view: "call",
      isHost: false,
      hostPeerId: HOST,
    });
    core.dialedPeerId = HOST;
    core.onWire(conn(HOST), { type: "room-denied", reason: "stale" });
    expect(core.state.callStatus).toBe("idle");
  });
});

/**
 * Sem girar o segredo, quem foi removido limpa o storage, ganha um peerId novo
 * e volta pelo mesmo link — o banimento por peerId sozinho não segura.
 */
describe("giro do segredo da sala", () => {
  it("remover alguém invalida o link que já estava por aí", () => {
    asHost();
    core.roomMembers = [
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.data.set(ZECA, conn(ZECA));
    core.patch({ remotes: [remote(ZECA, "Zeca")] });

    session.kickPeer(ZECA);
    const rotated = core.hostSecret;
    expect(rotated).not.toBe(SECRET);

    // Volta com chave nova, driblando o banimento, mas com o link antigo.
    const reborn = conn("outra-chave-1");
    core.data.set("outra-chave-1", reborn);
    core.onWire(reborn, hello("outra-chave-1", "Zeca", SECRET));
    expect(core.state.pending).toHaveLength(0);
    expect(reborn.sent).toContainEqual({
      type: "room-denied",
      reason: "stale",
    });
  });

  it("recusar alguém também gira o segredo", () => {
    asHost();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    session.denyPeer(ZECA);
    expect(core.hostSecret).not.toBe(SECRET);
  });

  it("membros que ficaram recebem o segredo novo", () => {
    asHost();
    core.roomMembers = [
      { peerId: ME, displayName: "Eu" },
      { peerId: ANA, displayName: "Ana" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    const ana = conn(ANA);
    core.data.set(ANA, ana);
    core.data.set(ZECA, conn(ZECA));
    core.patch({ remotes: [remote(ANA, "Ana"), remote(ZECA, "Zeca")] });

    session.kickPeer(ZECA);
    const announced = ana.sent.findLast((m) => m.type === "room-peers");
    expect(announced).toMatchObject({ secret: core.hostSecret });
  });

  it("quem nós discamos entra sem passar pela porta", () => {
    asHost();
    core.dialedPeerId = ZECA;
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    expect(core.state.pending).toHaveLength(0);
    expect(core.roomMembers.map((p) => p.peerId)).toContain(ZECA);
  });

  it("convidado marca espera ao receber room-waiting do host", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "connecting",
      view: "call",
      isHost: false,
      hostPeerId: HOST,
    });
    core.dialedPeerId = HOST;
    core.onWire(conn(HOST), { type: "room-waiting" });
    expect(core.state.callStatus).toBe("waiting");
  });

  it("convidado sai da chamada quando o host recusa", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "waiting",
      view: "call",
      isHost: false,
      hostPeerId: HOST,
    });
    core.dialedPeerId = HOST;
    core.onWire(conn(HOST), { type: "room-denied" });
    expect(core.state.callStatus).toBe("idle");
  });
});

/**
 * A aprovação do host só vale se ela for a única porta. Cada convidado do mesh
 * conhece o peerId dos outros pela lista da sala, então um estranho que
 * descubra qualquer uma dessas chaves não pode entrar por ela.
 */
describe("porta lateral pelos convidados", () => {
  it("convidado ignora hello de quem o host não admitiu", () => {
    asGuest();
    core.onWire(conn(INTRUDER), hello(INTRUDER, "Intruso"));
    expect(core.state.remotes.map((r) => r.peerId)).not.toContain(INTRUDER);
  });

  it("convidado não aceita chat de quem não está na lista do host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), hello(INTRUDER, "Intruso"));
    core.onWire(conn(INTRUDER), {
      type: "chat",
      id: "x",
      text: "oi",
      fromPeerId: INTRUDER,
      fromName: "Intruso",
      at: 1700000000000,
    });
    expect(core.state.messages).toHaveLength(0);
  });

  it("convidado aceita quem o host anunciou em room-peers", () => {
    asGuest();
    core.onWire(conn(HOST), {
      type: "room-peers",
      peers: [
        { peerId: HOST, displayName: "Host" },
        { peerId: ME, displayName: "Eu" },
        { peerId: ZECA, displayName: "Zeca" },
      ],
    });
    core.onWire(conn(ZECA), hello(ZECA, "Zeca"));
    expect(core.state.remotes.map((r) => r.peerId)).toContain(ZECA);
  });
});

describe("remoção de participante", () => {
  it("host remove, bane e derruba a pessoa da lista", () => {
    asHost();
    core.roomMembers = [
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    session.kickPeer(ZECA);
    expect(c.sent).toContainEqual({ type: "room-kicked" });
    expect(core.roomMembers.map((p) => p.peerId)).not.toContain(ZECA);
    expect(core.banned.has(ZECA)).toBe(true);
  });

  it("convidado não consegue remover ninguém", () => {
    asGuest();
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    session.kickPeer(ZECA);
    expect(core.banned.has(ZECA)).toBe(false);
    expect(core.state.remotes).toHaveLength(1);
  });

  it("o removido encerra a chamada ao receber o aviso do host", () => {
    asGuest();
    core.onWire(conn(HOST), { type: "room-kicked" });
    expect(core.state.callStatus).toBe("idle");
  });

  it("ignora room-kicked de quem não é o host", () => {
    asGuest();
    core.onWire(conn(INTRUDER), { type: "room-kicked" });
    expect(core.state.callStatus).toBe("in-call");
  });
});

describe("silenciar áudio e vídeo", () => {
  const withZeca = () => {
    core.roomMembers = [
      ...core.roomMembers,
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
  };

  it("convidado silencia outra pessoa só para si", () => {
    asGuest();
    withZeca();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    session.toggleLocalMute(ZECA, "audio");
    expect(core.state.localMutes[ZECA]).toEqual({ audio: true, video: false });
    expect(c.sent).toEqual([]);
  });

  it("ninguém silencia o host, nem local nem na sala", () => {
    asGuest();
    withZeca();
    session.toggleLocalMute(HOST, "audio");
    session.setRoomMute(HOST, "audio", true);
    expect(core.state.localMutes).toEqual({});
    expect(core.state.roomMutes).toEqual({});
    core.onWire(conn(HOST), { type: "room-mute", peerId: HOST, audio: true });
    expect(core.state.roomMutes).toEqual({});
  });

  it("convidado não consegue silenciar na sala", () => {
    asGuest();
    withZeca();
    session.setRoomMute(ZECA, "audio", true);
    expect(core.state.roomMutes).toEqual({});
    core.onWire(conn(INTRUDER), {
      type: "room-mute",
      peerId: ZECA,
      audio: true,
    });
    expect(core.state.roomMutes).toEqual({});
  });

  it("host silencia na sala e anuncia aos demais", () => {
    asHost();
    withZeca();
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    session.setRoomMute(ZECA, "audio", true);
    expect(core.state.roomMutes[ZECA]).toEqual({ audio: true, video: false });
    expect(c.sent).toContainEqual({
      type: "room-mute",
      peerId: ZECA,
      audio: true,
    });
  });

  it("quem foi silenciado na sala não reativa o microfone", () => {
    asGuest();
    const track = { enabled: true };
    core.patch({
      muted: false,
      localStream: {
        getAudioTracks: () => [track],
        getVideoTracks: () => [],
      } as unknown as MediaStream,
    });
    core.onWire(conn(HOST), { type: "room-mute", peerId: ME, audio: true });
    expect(core.state.roomMutes[ME]).toEqual({ audio: true, video: false });
    expect(core.state.muted).toBe(true);
    expect(track.enabled).toBe(false);
    session.toggleMute();
    expect(core.state.muted).toBe(true);
    expect(track.enabled).toBe(false);
  });

  it("quem foi silenciado na sala não religa a câmera", async () => {
    asGuest();
    core.patch({ cameraOff: true });
    core.onWire(conn(HOST), { type: "room-mute", peerId: ME, video: true });
    await session.toggleCamera();
    expect(core.state.cameraOff).toBe(true);
  });

  it("convidado não desliga o mute de sala para si mesmo", () => {
    asGuest();
    withZeca();
    core.onWire(conn(HOST), { type: "room-mute", peerId: ZECA, audio: true });
    session.toggleLocalMute(ZECA, "audio");
    expect(core.state.localMutes[ZECA]).toBeUndefined();
    expect(core.state.roomMutes[ZECA]).toEqual({ audio: true, video: false });
  });

  it("snapshot do host substitui os mutes da sala", () => {
    asGuest();
    withZeca();
    core.patch({
      roomMutes: { [ZECA]: { audio: true, video: true } },
    });
    core.onWire(conn(HOST), {
      type: "room-peers",
      peers: [
        { peerId: HOST, displayName: "Host" },
        { peerId: ME, displayName: "Eu" },
        { peerId: ZECA, displayName: "Zeca" },
      ],
      hostPeerId: HOST,
      mutes: [{ peerId: ZECA, audio: false, video: true }],
    });
    expect(core.state.roomMutes).toEqual({
      [ZECA]: { audio: false, video: true },
    });
  });
});

const mockGum = (
  impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
) => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: impl },
  });
};

const gumTrack = (kind: "audio" | "video") =>
  ({
    kind,
    enabled: true,
    readyState: "live",
    stop: vi.fn(),
  }) as unknown as MediaStreamTrack;

const gumStream = (...kinds: ("audio" | "video")[]) => {
  const tracks = kinds.map(gumTrack);
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((item) => item.kind === "audio"),
    getVideoTracks: () => tracks.filter((item) => item.kind === "video"),
  } as unknown as MediaStream;
};

describe("entrada sem câmera ou microfone", () => {
  it("cria a sala só com áudio se a câmera falhar", async () => {
    mockGum(async (constraints) => {
      if (constraints.video) throw new Error("sem camera");
      return gumStream("audio");
    });
    core.patch({ identity: { peerId: ME, displayName: "Eu" } });
    await session.createRoom();
    expect(core.state.view).toBe("call");
    expect(core.state.callStatus).toBe("in-call");
    expect(core.state.cameraOff).toBe(true);
    expect(core.state.muted).toBe(false);
    expect(getToast()?.key).toBe("toast.mediaAudioOnly");
  });

  it("cria a sala só ouvindo quando nada é permitido", async () => {
    mockGum(async () => {
      throw new Error("negado");
    });
    core.patch({ identity: { peerId: ME, displayName: "Eu" } });
    await session.createRoom();
    expect(core.state.view).toBe("call");
    expect(core.state.cameraOff).toBe(true);
    expect(core.state.muted).toBe(true);
    expect(getToast()?.key).toBe("toast.mediaListenOnly");
  });

  it("cria a sala com câmera se só o microfone falhar", async () => {
    mockGum(async (constraints) => {
      if (constraints.audio) throw new Error("sem mic");
      return gumStream("video");
    });
    core.patch({ identity: { peerId: ME, displayName: "Eu" } });
    await session.createRoom();
    expect(core.state.view).toBe("call");
    expect(core.state.cameraOff).toBe(false);
    expect(core.state.muted).toBe(true);
    expect(getToast()?.key).toBe("toast.mediaVideoOnly");
  });

  it("religar o microfone pede o dispositivo de novo", async () => {
    mockGum(async () => gumStream("audio"));
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "in-call",
      view: "call",
      muted: true,
      cameraOff: true,
      localStream: gumStream(),
    });
    await session.toggleMute();
    expect(core.state.muted).toBe(false);
    expect(core.state.localStream?.getAudioTracks().length).toBeGreaterThan(0);
  });
});

describe("falha de caminho ICE", () => {
  it("volta à home com aviso de rede se o ICE nunca conectou ao ligar", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "connecting",
      view: "call",
      isHost: true,
      hostPeerId: ME,
    });
    core.handleIceGaveUp(HOST);
    expect(core.state.callStatus).toBe("idle");
    expect(core.state.view).toBe("home");
    expect(getToast()?.key).toBe("toast.networkPath");
  });

  it("não diz que a pessoa saiu se o ICE falhou sem nunca conectar", () => {
    asHost();
    core.names.set(ZECA, "Zeca");
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    core.handleIceGaveUp(ZECA);
    expect(core.state.pathHint).toBe(true);
    expect(core.state.remotes).toHaveLength(0);
    expect(getToast()?.key).toBe("toast.networkPathPeer");
  });

  it("trata ICE failed depois de conectar como queda normal", () => {
    asHost();
    core.names.set(ZECA, "Zeca");
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    core.iceEverConnected.add(ZECA);
    core.handleIceGaveUp(ZECA);
    expect(core.state.pathHint).toBe(false);
    expect(getToast()?.key).toBe("toast.peerLeft");
  });

  it("anuncia saída no chat só uma vez mesmo com vários eventos", () => {
    asGuest();
    core.names.set(ZECA, "Zeca");
    core.roomMembers = [
      { peerId: HOST, displayName: "Host" },
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    core.onPeerLeft(ZECA);
    core.onPeerLeft(ZECA);
    core.onPeerLeft(ZECA);
    const left = core.state.messages.filter((msg) => msg.system === "left");
    expect(left).toHaveLength(1);
    expect(left[0]?.fromPeerId).toBe(ZECA);
    expect(core.roomMembers.some((member) => member.peerId === ZECA)).toBe(
      false,
    );
  });
});

describe("envio de arquivo", () => {
  afterEach(() => {
    setDemoTier("free");
  });

  it("aceita envio no plano gratuito até 10 MB", async () => {
    setDemoTier("free");
    asHost();
    await session.sendFile(new File(["ok"], "a.txt", { type: "text/plain" }));
    expect(core.state.messages.at(-1)?.file?.name).toBe("a.txt");
    expect(core.state.messages.at(-1)?.file?.status).toBe("ready");
  });

  it("recusa arquivo acima do limite gratuito", async () => {
    setDemoTier("free");
    asHost();
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.bin");
    await session.sendFile(big);
    expect(getToast()?.key).toBe("toast.fileTooBig");
    expect(core.state.messages).toHaveLength(0);
  });

  it("aceita envio no plano Pro", async () => {
    setDemoTier("pro");
    asHost();
    await session.sendFile(new File(["ok"], "a.txt", { type: "text/plain" }));
    expect(core.state.messages.at(-1)?.file?.name).toBe("a.txt");
    expect(core.state.messages.at(-1)?.file?.status).toBe("ready");
  });
});

describe("timer e voto no chat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const poll = {
    type: "chat" as const,
    id: "p1",
    text: "Votação: pizza, sushi",
    fromPeerId: HOST,
    fromName: "Host",
    at: 1,
    command: { kind: "poll" as const, id: "poll-1", options: ["pizza", "sushi"] },
  };

  it("avisa quando o timer acaba mesmo com o chat fechado", () => {
    vi.useFakeTimers();
    asGuest();
    expect(session.sendChat("/timer 5s")).toBe(true);
    expect(getToast()?.key).not.toBe("chat.command.timerDone");
    vi.advanceTimersByTime(5_000);
    expect(getToast()?.key).toBe("chat.command.timerDone");
    vi.useRealTimers();
  });

  it("aplica o voto local e anuncia só se mudou", () => {
    asGuest();
    const c = conn(HOST);
    core.data.set(HOST, c);
    core.onWire(conn(HOST), poll);
    session.votePoll("poll-1", 0);
    expect(core.state.messages.at(-1)?.pollVotes).toEqual({ [ME]: 0 });
    expect(c.sent).toEqual([{ type: "poll-vote", id: "poll-1", option: 0 }]);
    c.sent.length = 0;
    session.votePoll("poll-1", 0);
    expect(c.sent).toEqual([]);
    session.votePoll("poll-1", 1);
    expect(core.state.messages.at(-1)?.pollVotes).toEqual({ [ME]: 1 });
    expect(c.sent).toEqual([{ type: "poll-vote", id: "poll-1", option: 1 }]);
  });

  it("usa a conexão como votante, não o payload", () => {
    asGuest();
    core.roomMembers = [
      ...core.roomMembers,
      { peerId: "bruno-1", displayName: "Bruno" },
    ];
    core.onWire(conn(HOST), poll);
    core.onWire(conn("bruno-1"), { type: "poll-vote", id: "poll-1", option: 1 });
    expect(core.state.messages.at(-1)?.pollVotes).toEqual({ "bruno-1": 1 });
  });

  it("ignora voto de quem não está na sala", () => {
    asGuest();
    core.onWire(conn(HOST), poll);
    core.onWire(conn(INTRUDER), { type: "poll-vote", id: "poll-1", option: 0 });
    expect(core.state.messages.at(-1)?.pollVotes).toBeUndefined();
  });

  it("ignora opção que a enquete não tem", () => {
    asGuest();
    core.onWire(conn(HOST), poll);
    core.onWire(conn(HOST), { type: "poll-vote", id: "poll-1", option: 9 });
    expect(core.state.messages.at(-1)?.pollVotes).toBeUndefined();
  });
});
