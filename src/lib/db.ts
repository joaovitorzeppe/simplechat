import Dexie, { type Table } from "dexie";
import { loadIdentity } from "./identity";
import type { HistoryCall, HistoryMessage, PeerInfo } from "./types";

const OPT_IN_KEY = "simplechat.historyOptIn";

class SimpleChatDB extends Dexie {
  calls!: Table<HistoryCall, string>;
  messages!: Table<HistoryMessage, string>;

  constructor() {
    super("simplechat");
    this.version(1).stores({
      calls: "id, startedAt",
      messages: "id, callId, at",
    });
  }
}

export const db = new SimpleChatDB();

export const isHistoryOptIn = () => {
  return localStorage.getItem(OPT_IN_KEY) === "1" && loadIdentity() !== null;
};

export const setHistoryOptIn = (enabled: boolean) => {
  localStorage.setItem(OPT_IN_KEY, enabled ? "1" : "0");
};

export const startHistoryCall = async (call: HistoryCall) => {
  if (!isHistoryOptIn()) return;
  await db.calls.put(call);
};

export const touchHistoryParticipants = async (
  callId: string,
  participants: PeerInfo[],
) => {
  if (!isHistoryOptIn()) return;
  const existing = await db.calls.get(callId);
  if (!existing) return;
  await db.calls.update(callId, { participants });
};

export const appendHistoryMessage = async (message: HistoryMessage) => {
  if (!isHistoryOptIn()) return;
  await db.messages.put(message);
};

export const endHistoryCall = async (callId: string) => {
  if (!isHistoryOptIn()) return;
  await db.calls.update(callId, { endedAt: Date.now() });
};

export const listHistoryCalls = async () => {
  return db.calls.orderBy("startedAt").reverse().toArray();
};

export const listHistoryMessages = async (callId: string) => {
  return db.messages.where("callId").equals(callId).sortBy("at");
};

export const clearHistory = async () => {
  await db.transaction("rw", db.calls, db.messages, async () => {
    await db.messages.clear();
    await db.calls.clear();
  });
};
