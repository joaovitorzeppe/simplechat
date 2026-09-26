import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { electHost, PeerSession, type SessionState } from "@libs/session";
import { getToast } from "@libs/toast";
import type { PeerInfo, RemotePeer, WireMessage } from "@libs/types";

type FakeConn = {
  peer: string;
  open: boolean;
  sent: WireMessage[];
  send: (message: WireMessage) => void;
  close: () => void;
  removeAllListeners: () => void;
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
  data: Map<string, FakeConn>;
  calls: Map<string, { peerConnection?: unknown }>;
  attachMedia: (call: unknown) => void;
  redialPeer: (peerId: string) => void;
  room: {
    roomMembers: PeerInfo[];
    banned: Set<string>;
    hostSecret: string | null;
    dialedPeerId: string | null;
  };
  media: { outboundStream: () => MediaStream };
  files: {
    incomingFiles: Map<string, unknown>;
    queueIncoming: (peerId: string, data: ArrayBuffer) => void;
    onFileBytes: (conn: unknown, raw: unknown) => boolean;
    failIncomingFile: (peerId: string) => void;
    bridge: {
      openReceive: () => Promise<void>;
      push: () => Promise<number>;
      abort: () => Promise<void>;
    };
  };
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
  removeAllListeners: () => {},
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
  core.room.dialedPeerId = HOST;
  core.room.roomMembers = [
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
  core.room.hostSecret = SECRET;
  core.room.roomMembers = [{ peerId: ME, displayName: "Eu" }];
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
    core.room.roomMembers = [
      ...core.room.roomMembers,
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
    core.room.roomMembers = [
      ...core.room.roomMembers,
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

  it("/me e /moeda incluem o autor nas menções para pintar o @", () => {
    asGuest();
    core.room.roomMembers = [
      ...core.room.roomMembers,
      { peerId: ZECA, displayName: "Zeca" },
    ];
    expect(session.sendChat("/me acena para @Zeca")).toBe(true);
    const emote = core.state.messages.at(-1);
    expect(emote?.text).toBe("@Eu acena para @Zeca");
    expect(emote?.mentions).toEqual(expect.arrayContaining([ME, ZECA]));
    expect(session.sendChat("/moeda")).toBe(true);
    const coin = core.state.messages.at(-1);
    expect(coin?.text).toMatch(/^@Eu /);
    expect(coin?.mentions).toEqual([ME]);
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
    expect(core.files.incomingFiles.size).toBe(0);
    expect(core.state.messages).toHaveLength(0);
  });

  it("aceita file-start de quem está na sala", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    expect(core.files.incomingFiles.size).toBe(1);
    expect(core.state.messages.at(-1)?.file?.name).toBe("foto.png");
  });

  it("aplica cooldown para não permitir enxurrada de file-start", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    for (let i = 0; i < 50; i += 1) {
      core.onWire(conn(HOST), { ...fileStart, id: `f${i}` });
    }
    expect(core.files.incomingFiles.size).toBe(1);
  });

  it("não confia no id do remetente para identificar a mensagem", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    expect(core.state.messages.at(-1)?.id).not.toBe("f1");
  });

  it("falha a recepção quando chega um pedaço maior que FILE_CHUNK", () => {
    asGuest();
    core.onWire(conn(HOST), fileStart);
    core.files.onFileBytes(conn(HOST), new ArrayBuffer(16 * 1024 + 1));
    expect(core.files.incomingFiles.size).toBe(0);
    expect(core.state.messages.at(-1)?.file?.status).toBe("error");
  });

  it("aborta só depois dos bytes que já estavam na fila", async () => {
    asGuest();
    const calls: string[] = [];
    let release = () => {};
    core.files.bridge = {
      openReceive: async () => {
        calls.push("open");
      },
      push: () =>
        new Promise<number>((resolve) => {
          calls.push("push");
          release = () => resolve(10);
        }),
      abort: async () => {
        calls.push("abort");
      },
    };
    core.onWire(conn(HOST), fileStart);
    core.files.queueIncoming(HOST, new ArrayBuffer(10));
    await vi.waitFor(() => expect(calls).toEqual(["open", "push"]));
    core.files.failIncomingFile(HOST);
    await Promise.resolve();
    expect(calls).toEqual(["open", "push"]);
    release();
    await vi.waitFor(() => expect(calls).toEqual(["open", "push", "abort"]));
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
    core.room.roomMembers = [
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
    core.room.roomMembers = [
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
    expect(core.room.roomMembers).toHaveLength(1);
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
    expect(core.room.roomMembers).toContainEqual({
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
    core.room.dialedPeerId = HOST;
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
    core.room.roomMembers = [
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.data.set(ZECA, conn(ZECA));
    core.patch({ remotes: [remote(ZECA, "Zeca")] });

    // Como a UI passa a referência do método, o `this` precisa sobreviver.
    const kick = session.kickPeer;
    kick(ZECA);
    const rotated = core.room.hostSecret;
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
    expect(core.room.hostSecret).not.toBe(SECRET);
  });

  it("membros que ficaram recebem o segredo novo", () => {
    asHost();
    core.room.roomMembers = [
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
    expect(announced).toMatchObject({ secret: core.room.hostSecret });
  });

  it("quem nós discamos entra sem passar pela porta", () => {
    asHost();
    core.room.dialedPeerId = ZECA;
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.onWire(c, hello(ZECA, "Zeca"));
    expect(core.state.pending).toHaveLength(0);
    expect(core.room.roomMembers.map((p) => p.peerId)).toContain(ZECA);
  });

  it("convidado marca espera ao receber room-waiting do host", () => {
    core.patch({
      identity: { peerId: ME, displayName: "Eu" },
      callStatus: "connecting",
      view: "call",
      isHost: false,
      hostPeerId: HOST,
    });
    core.room.dialedPeerId = HOST;
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
    core.room.dialedPeerId = HOST;
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
    core.room.roomMembers = [
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    const c = conn(ZECA);
    core.data.set(ZECA, c);
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    session.kickPeer(ZECA);
    expect(c.sent).toContainEqual({ type: "room-kicked" });
    expect(core.room.roomMembers.map((p) => p.peerId)).not.toContain(ZECA);
    expect(core.room.banned.has(ZECA)).toBe(true);
  });

  it("convidado não consegue remover ninguém", () => {
    asGuest();
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    session.kickPeer(ZECA);
    expect(core.room.banned.has(ZECA)).toBe(false);
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
    core.room.roomMembers = [
      ...core.room.roomMembers,
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
    void session.toggleMute();
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
      if (constraints.video) {
        throw new Error("sem camera");
      }
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
      if (constraints.audio) {
        throw new Error("sem mic");
      }
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

const stubPlaceholderCapture = () => {
  const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  const prev = proto.captureStream;
  const ctx = HTMLCanvasElement.prototype.getContext;
  proto.captureStream = () => gumStream("video");
  HTMLCanvasElement.prototype.getContext = (() =>
    ({ fillRect() {} })) as unknown as typeof ctx;
  return () => {
    proto.captureStream = prev;
    HTMLCanvasElement.prototype.getContext = ctx;
  };
};

describe("câmera ligada depois do offer", () => {
  it("reserva faixa de vídeo no outbound mesmo com câmera off", () => {
    const restore = stubPlaceholderCapture();
    try {
      core.patch({
        cameraOff: true,
        localStream: gumStream("audio"),
      });
      const out = core.media.outboundStream();
      expect(out.getVideoTracks()).toHaveLength(1);
      expect(out.getAudioTracks()).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it("religar a câmera troca a faixa no sender que já existia", async () => {
    const restore = stubPlaceholderCapture();
    const replaceTrack = vi.fn(async () => {});
    const slot = gumTrack("video");
    core.calls.set(ZECA, {
      peerConnection: {
        getSenders: () => [{ track: slot, replaceTrack }],
        getTransceivers: () => [],
      },
    });
    const next = gumTrack("video");
    mockGum(async () => {
      const audio = gumTrack("audio");
      return {
        getTracks: () => [next],
        getAudioTracks: () => [audio],
        getVideoTracks: () => [next],
      } as unknown as MediaStream;
    });
    core.patch({
      cameraOff: true,
      localStream: gumStream("audio"),
    });
    try {
      await session.toggleCamera();
      expect(core.state.cameraOff).toBe(false);
      expect(replaceTrack).toHaveBeenCalledWith(next);
    } finally {
      restore();
    }
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
    core.room.roomMembers = [
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
    expect(core.room.roomMembers.some((member) => member.peerId === ZECA)).toBe(
      false,
    );
  });

  it("não duplica aviso se close() reentra em onPeerLeft", () => {
    asGuest();
    core.names.set(ZECA, "Zeca");
    core.room.roomMembers = [
      { peerId: HOST, displayName: "Host" },
      { peerId: ME, displayName: "Eu" },
      { peerId: ZECA, displayName: "Zeca" },
    ];
    core.patch({ remotes: [remote(ZECA, "Zeca")] });
    const c = conn(ZECA);
    c.close = () => {
      core.onPeerLeft(ZECA);
    };
    core.data.set(ZECA, c);
    core.onPeerLeft(ZECA);
    const left = core.state.messages.filter((msg) => msg.system === "left");
    expect(left).toHaveLength(1);
    expect(getToast()?.key).toBe("toast.peerLeft");
  });

  it("religar a mídia não trata o fim da chamada antiga como saída", () => {
    asGuest();
    core.room.roomMembers = [...core.room.roomMembers, { peerId: ANA, displayName: "Ana" }];
    core.patch({ remotes: [remote(ANA, "Ana")] });
    const handlers = new Map<string, () => void>();
    core.attachMedia({
      peer: ANA,
      on: (event: string, handler: () => void) => handlers.set(event, handler),
      close: () => handlers.get("close")?.(),
    });
    core.redialPeer(ANA);
    expect(core.state.remotes).toHaveLength(1);
    expect(core.room.roomMembers.some((member) => member.peerId === ANA)).toBe(true);
  });
});

describe("envio de arquivo", () => {
  it("aceita envio até o limite", async () => {
    asHost();
    await session.sendFile(new File(["ok"], "a.txt", { type: "text/plain" }));
    expect(core.state.messages.at(-1)?.file?.name).toBe("a.txt");
    expect(core.state.messages.at(-1)?.file?.status).toBe("ready");
  });

  it("recusa arquivo acima do limite", async () => {
    asHost();
    const big = new File([new Uint8Array(100 * 1024 * 1024 + 1)], "big.bin");
    await session.sendFile(big);
    expect(getToast()?.key).toBe("toast.fileTooBig");
    expect(core.state.messages).toHaveLength(0);
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

  it("recusa um segundo timer enquanto o primeiro está ativo", () => {
    vi.useFakeTimers();
    asGuest();
    expect(session.sendChat("/timer 30s")).toBe(true);
    expect(session.sendChat("/timer 5s")).toBe(false);
    expect(getToast()?.key).toBe("chat.command.timerBusy");
    vi.useRealTimers();
  });

  it("pausa e retoma o timer, e só autor ou host controlam", () => {
    vi.useFakeTimers();
    asGuest();
    const c = conn(HOST);
    core.data.set(HOST, c);
    expect(session.sendChat("/timer 10s")).toBe(true);
    const id = core.state.messages.at(-1)?.id;
    expect(id).toBeTruthy();
    vi.advanceTimersByTime(3_000);
    session.controlTimer(id!, "pause");
    expect(core.state.messages.at(-1)?.timer).toEqual({
      status: "paused",
      remainingMs: 7_000,
    });
    expect(c.sent.at(-1)).toEqual({
      type: "timer-control",
      id,
      timer: { status: "paused", remainingMs: 7_000 },
    });
    vi.advanceTimersByTime(60_000);
    expect(getToast()?.key).not.toBe("chat.command.timerDone");
    session.controlTimer(id!, "resume");
    expect(core.state.messages.at(-1)?.timer?.status).toBe("running");
    vi.advanceTimersByTime(7_000);
    expect(getToast()?.key).toBe("chat.command.timerDone");
    vi.useRealTimers();
  });

  it("timer-control remoto acha a mensagem pelo id do fio", () => {
    asGuest();
    core.onWire(conn(HOST), {
      type: "chat",
      id: "t-shared",
      text: "Timer: 0:10",
      fromPeerId: HOST,
      fromName: "Host",
      at: Date.now(),
      command: { kind: "timer", ms: 10_000 },
    });
    expect(core.state.messages.at(-1)?.id).toBe("t-shared");
    core.onWire(conn(HOST), {
      type: "timer-control",
      id: "t-shared",
      timer: { status: "paused", remainingMs: 4_000 },
    });
    expect(core.state.messages.at(-1)?.timer).toEqual({
      status: "paused",
      remainingMs: 4_000,
      byHost: true,
    });
    core.onWire(conn(HOST), {
      type: "timer-control",
      id: "t-shared",
      timer: { status: "cancelled" },
    });
    expect(core.state.messages.at(-1)?.timer).toEqual({
      status: "cancelled",
      byHost: true,
    });
  });

  it("host cancela timer de outra pessoa; convidado estranho não", () => {
    vi.useFakeTimers();
    asGuest();
    core.onWire(conn(HOST), {
      type: "chat",
      id: "t-host",
      text: "Timer: 0:10",
      fromPeerId: HOST,
      fromName: "Host",
      at: Date.now(),
      command: { kind: "timer", ms: 10_000 },
    });
    session.controlTimer("t-host", "cancel");
    expect(core.state.messages.at(-1)?.timer?.status).not.toBe("cancelled");

    asHost();
    core.patch({
      messages: [
        {
          id: "t-guest",
          text: "Timer: 0:10",
          fromPeerId: ZECA,
          fromName: "Zeca",
          at: Date.now(),
          command: { kind: "timer", ms: 10_000 },
          timer: { status: "running", endsAt: Date.now() + 10_000 },
        },
      ],
    });
    session.controlTimer("t-guest", "cancel");
    expect(core.state.messages.at(-1)?.timer).toEqual({
      status: "cancelled",
      byHost: true,
    });
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
    core.room.roomMembers = [
      ...core.room.roomMembers,
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

  it("recusa enquete com id repetido para não sequestrar os votos", () => {
    asGuest();
    core.room.roomMembers = [
      ...core.room.roomMembers,
      { peerId: "bruno-1", displayName: "Bruno" },
    ];
    core.onWire(conn(HOST), poll);
    core.onWire(conn("bruno-1"), { ...poll, id: "p2", fromPeerId: "bruno-1" });
    expect(core.state.messages).toHaveLength(1);
    core.onWire(conn("bruno-1"), { type: "poll-vote", id: "poll-1", option: 1 });
    expect(core.state.messages[0]?.pollVotes).toEqual({ "bruno-1": 1 });
  });
});

describe("troca de câmera", () => {
  const videoCam = (id: string, facing?: string) =>
    ({
      kind: "video",
      enabled: true,
      readyState: "live",
      stop: vi.fn(),
      getSettings: () => ({ deviceId: id, facingMode: facing }),
    }) as unknown as MediaStreamTrack;

  const streamWith = (video: MediaStreamTrack) => {
    const audio = gumTrack("audio");
    return {
      getTracks: () => [audio, video],
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
    } as unknown as MediaStream;
  };

  const mockCams = (
    ids: string[],
    gum: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
    labels?: Record<string, string>,
  ) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: gum,
        enumerateDevices: async () =>
          ids.map((deviceId) => ({
            deviceId,
            kind: "videoinput" as const,
            label:
              labels?.[deviceId] ??
              (/front/i.test(deviceId)
                ? "Front Camera"
                : `Back ${deviceId} Camera`),
            groupId: "",
            toJSON() {
              return this;
            },
          })),
      },
    });
  };

  it("alterna frente e traseira sem passar pelas extras", async () => {
    const oldVideo = videoCam("front", "user");
    const newVideo = videoCam("dual", "environment");
    const gum = vi.fn(async (_constraints: MediaStreamConstraints) => {
      expect(oldVideo.stop).toHaveBeenCalled();
      return streamWith(newVideo);
    });
    mockCams(["front", "dual", "ultra", "tele"], gum);
    core.patch({ cameraOff: false, localStream: streamWith(oldVideo) });
    await session.switchCamera();
    const args = gum.mock.calls[0];
    if (!args) {
      throw new Error("expected getUserMedia call");
    }
    expect(args[0].video).toEqual({ deviceId: { exact: "dual" } });
    expect(oldVideo.stop).toHaveBeenCalled();
    expect(core.state.localStream?.getVideoTracks()[0]).toBe(newVideo);
    expect(core.state.canSwitchCamera).toBe(true);
  });

  it("da traseira volta para a frontal", async () => {
    const gum = vi.fn(async (_constraints: MediaStreamConstraints) =>
      streamWith(videoCam("front", "user")),
    );
    mockCams(["front", "dual", "ultra"], gum);
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("ultra", "environment")),
    });
    await session.switchCamera();
    const args = gum.mock.calls[0];
    if (!args) {
      throw new Error("expected getUserMedia call");
    }
    expect(args[0].video).toEqual({ deviceId: { exact: "front" } });
  });

  it("não pede câmera se só existe uma", async () => {
    const gum = vi.fn();
    mockCams(["cam-a"], gum);
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("cam-a")),
    });
    await session.switchCamera();
    expect(gum).not.toHaveBeenCalled();
  });

  it("não troca com a câmera desligada", async () => {
    const gum = vi.fn();
    mockCams(["cam-a", "cam-b"], gum);
    core.patch({ cameraOff: true });
    await session.switchCamera();
    expect(gum).not.toHaveBeenCalled();
  });

  it("com mais de duas, só usa câmera com frente/trás no rótulo", async () => {
    const gum = vi.fn(async (_constraints: MediaStreamConstraints) =>
      streamWith(videoCam("back", "environment")),
    );
    mockCams(["front", "back", "usb"], gum, {
      front: "Front Camera",
      back: "Back Camera",
      usb: "USB Capture",
    });
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("front", "user")),
    });
    await session.switchCamera();
    const args = gum.mock.calls[0];
    if (!args) {
      throw new Error("expected getUserMedia call");
    }
    expect(args[0].video).toEqual({ deviceId: { exact: "back" } });
  });

  it("se o deviceId falha, tenta facingMode ideal", async () => {
    const gum = vi.fn(async (constraints: MediaStreamConstraints) => {
      const video = constraints.video as MediaTrackConstraints;
      if (video.deviceId) {
        throw new Error("id recusado");
      }
      return streamWith(videoCam("back", "environment"));
    });
    mockCams(["front", "back"], gum);
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("front", "user")),
    });
    await session.switchCamera();
    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[1]?.[0].video).toEqual({
      facingMode: { ideal: "environment" },
    });
    expect(core.state.localStream?.getVideoTracks()[0]?.getSettings()).toEqual(
      expect.objectContaining({ deviceId: "back" }),
    );
  });

  it("se a troca falha, avisa e reabre a câmera", async () => {
    const restored = videoCam("front", "user");
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new Error("busy"))
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce(streamWith(restored));
    mockCams(["front", "back"], gum);
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("front", "user")),
    });
    await session.switchCamera();
    expect(getToast()?.key).toBe("toast.mediaSwitchCamera");
    expect(core.state.localStream?.getVideoTracks()[0]).toBe(restored);
  });

  it("não troca se o filtro deixa menos de duas", async () => {
    const gum = vi.fn();
    mockCams(["front", "usb", "hdmi"], gum, {
      front: "Front Camera",
      usb: "USB Capture",
      hdmi: "HDMI",
    });
    core.patch({
      cameraOff: false,
      localStream: streamWith(videoCam("front", "user")),
    });
    await session.switchCamera();
    expect(gum).not.toHaveBeenCalled();
  });
});
