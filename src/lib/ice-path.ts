/**
 * ICE `failed` depois de mídia fluir costuma ser queda. `failed` sem nunca
 * ter conectado é o sintoma clássico de NAT simétrico / firewall corporativo
 * (o que TURN ou outra rede resolveria). O browser não expõe "faltou TURN".
 */
export const iceGaveUpKind = (everConnected: boolean): "path" | "drop" =>
  everConnected ? "drop" : "path";

/** Ainda tentando; já vale mostrar o aviso de rede. */
export const CONNECT_HINT_MS = 12_000;
/** Sem data channel, desistimos e voltamos à home. */
export const CONNECT_GIVE_UP_MS = 25_000;
