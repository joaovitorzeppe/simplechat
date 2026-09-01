import { describe, expect, it } from "vitest";
import {
  dropMute,
  muteOf,
  MUTE_OFF,
  roomMutesFromWire,
  roomMutesToWire,
  setMuteFlag,
} from "@libs/mutes";

describe("mutes", () => {
  it("liga e desliga uma flag sem deixar entrada vazia", () => {
    const audio = setMuteFlag({}, "ana-1", "audio", true);
    expect(muteOf(audio, "ana-1")).toEqual({ audio: true, video: false });
    const both = setMuteFlag(audio, "ana-1", "video", true);
    expect(both["ana-1"]).toEqual({ audio: true, video: true });
    const cleared = setMuteFlag(both, "ana-1", "audio", false);
    expect(cleared["ana-1"]).toEqual({ audio: false, video: true });
    expect(setMuteFlag(cleared, "ana-1", "video", false)).toEqual({});
  });

  it("não reescreve o mapa quando o valor já vale", () => {
    const map = setMuteFlag({}, "ana-1", "audio", true);
    expect(setMuteFlag(map, "ana-1", "audio", true)).toBe(map);
    expect(setMuteFlag({}, "ana-1", "audio", false)).toEqual({});
  });

  it("ignora o host no fio e descarta flags desligadas", () => {
    expect(
      roomMutesFromWire(
        [
          { peerId: "host-1", audio: true, video: true },
          { peerId: "ana-1", audio: true, video: false },
          { peerId: "zeca-1", audio: false, video: false },
        ],
        "host-1",
      ),
    ).toEqual({ "ana-1": { audio: true, video: false } });
    expect(
      roomMutesToWire(
        {
          "host-1": { audio: true, video: true },
          "ana-1": { audio: true, video: false },
        },
        "host-1",
      ),
    ).toEqual([{ peerId: "ana-1", audio: true, video: false }]);
  });

  it("remove um peer sem mexer nos outros", () => {
    const map = {
      "ana-1": { audio: true, video: false },
      "zeca-1": { audio: false, video: true },
    };
    expect(dropMute(map, "ana-1")).toEqual({
      "zeca-1": { audio: false, video: true },
    });
    expect(dropMute(map, "bruno-1")).toBe(map);
    expect(muteOf({}, "ana-1")).toBe(MUTE_OFF);
  });
});
