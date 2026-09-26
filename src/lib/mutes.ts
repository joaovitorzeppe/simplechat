export type MuteKind = "audio" | "video";

export type MuteFlags = {
  audio: boolean;
  video: boolean;
};

export type MuteMap = Record<string, MuteFlags>;

export type RoomMuteEntry = {
  peerId: string;
  audio: boolean;
  video: boolean;
};

export const MUTE_OFF: MuteFlags = { audio: false, video: false };

export const muteOf = (map: MuteMap, peerId: string): MuteFlags => {
  return map[peerId] ?? MUTE_OFF;
};

export const setMuteFlag = (
  map: MuteMap,
  peerId: string,
  kind: MuteKind,
  value: boolean,
): MuteMap => {
  const next: MuteFlags = { ...muteOf(map, peerId), [kind]: value };
  if (!next.audio && !next.video) {
    if (!(peerId in map)) {
      return map;
    }
    const { [peerId]: _, ...rest } = map;
    return rest;
  }
  const current = map[peerId];
  if (current && current.audio === next.audio && current.video === next.video) {
    return map;
  }
  return { ...map, [peerId]: next };
};

export const dropMute = (map: MuteMap, peerId: string): MuteMap => {
  if (!(peerId in map)) {
    return map;
  }
  const { [peerId]: _, ...rest } = map;
  return rest;
};

export const roomMutesFromWire = (
  entries: RoomMuteEntry[],
  hostPeerId: string | null,
): MuteMap => {
  const out: MuteMap = {};
  for (const entry of entries) {
    if (entry.peerId === hostPeerId) {
      continue;
    }
    if (!entry.audio && !entry.video) {
      continue;
    }
    out[entry.peerId] = { audio: entry.audio, video: entry.video };
  }
  return out;
};

export const roomMutesToWire = (
  map: MuteMap,
  hostPeerId: string | null,
): RoomMuteEntry[] => {
  const out: RoomMuteEntry[] = [];
  for (const [peerId, flags] of Object.entries(map)) {
    if (peerId === hostPeerId || (!flags.audio && !flags.video)) {
      continue;
    }
    out.push({ peerId, audio: flags.audio, video: flags.video });
  }
  return out;
};
