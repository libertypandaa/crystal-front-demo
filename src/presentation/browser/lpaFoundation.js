// Game-side adapters for the pinned Liberty Panda SDKs. No host DOM, tokens, or RPCs enter the game.
const SAVE_SCHEMA = 1;
const READY_NAMESPACE = /^lpa:save:v1:[0-9a-f]{64}$/;

function validProgress(progress) {
  return progress && !Array.isArray(progress) && typeof progress === "object"
    && progress.profile && !Array.isArray(progress.profile) && typeof progress.profile === "object"
    && typeof progress.profile.nickname === "string"
    && typeof progress.profile.nicknameSet === "boolean"
    && progress.bonuses && !Array.isArray(progress.bonuses) && typeof progress.bonuses === "object"
    && ["bomb", "line", "mix", "color"].every(key => Number.isSafeInteger(progress.bonuses[key]) && progress.bonuses[key] >= 0)
    && progress.shop && !Array.isArray(progress.shop) && typeof progress.shop === "object"
    && Number.isFinite(progress.shop.lastAdClaimAt) && progress.shop.lastAdClaimAt >= 0;
}

export function createTelemetry(sdk) {
  let activeMatch = false;
  let telemetryId = null;
  const call = (name, ...args) => {
    try { return sdk?.[name]?.(...args); } catch { return null; }
  };
  return {
    ready() { call("ready"); },
    setPlaying(playing) { call("setPlaying", playing === true); },
    matchStart(mode) {
      if (activeMatch) this.matchEnd("abandon", 0);
      activeMatch = true;
      telemetryId = call("matchStart", mode) ?? null;
      return telemetryId;
    },
    matchEnd(outcome, score) {
      if (!activeMatch) return false;
      activeMatch = false;
      call("setPlaying", false);
      const id = telemetryId;
      telemetryId = null;
      return id ? call("matchEnd", id, outcome, Number.isFinite(score) ? score : 0) === true : false;
    },
    hasMatch() { return activeMatch; },
  };
}

export async function readEconomy(sdk) {
  if (!sdk) return { status: "unavailable" };
  try {
    if (await sdk.ready !== true || !sdk.available?.()) return { status: "unavailable" };
    const capabilities = await sdk.capabilities();
    const [wallet, catalog, inventory] = await Promise.all([sdk.wallet(), sdk.catalog(), sdk.inventory()]);
    return { status: "ready", capabilities, wallet, catalog, inventory };
  } catch (error) {
    return { status: "error", code: typeof error?.message === "string" ? error.message : "REQUEST_FAILED" };
  }
}

export function writeVerifiedJson(storage, key, value) {
  const raw = JSON.stringify(value);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error("STORAGE_UNAVAILABLE");
}

// Account-local progress is separate from the legacy standalone key. A context is captured
// with its snapshot and rechecked immediately before each synchronous storage commit.
export function createAccountProgressAdapter(platform, storage, serialize = async value => JSON.stringify(value)) {
  function currentOwner() {
    const owner = platform.accountContext();
    if (owner?.status !== "ready" || owner.gameId !== "crystal-front-demo"
      || !READY_NAMESPACE.test(owner.storageNamespace ?? "")
      || !platform.isAccountContextCurrent(owner)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
    return owner;
  }
  const keyFor = owner => `${owner.storageNamespace}:crystalFrontProgress:v1`;
  function envelope(owner, progress) {
    return { schema: SAVE_SCHEMA, gameId: owner.gameId, progress };
  }
  function commit(owner, raw) {
    if (!platform.isAccountContextCurrent(owner)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
    const key = keyFor(owner);
    storage.setItem(key, raw); // no await between the fence and this commit
    if (storage.getItem(key) !== raw) throw new Error("STORAGE_UNAVAILABLE");
  }
  return {
    read() {
      const owner = currentOwner();
      const raw = storage.getItem(keyFor(owner));
      if (!platform.isAccountContextCurrent(owner)) throw new Error("ACCOUNT_CONTEXT_CHANGED");
      if (raw === null) return null;
      const saved = JSON.parse(raw);
      if (saved?.schema !== SAVE_SCHEMA || saved.gameId !== owner.gameId || !validProgress(saved.progress)) {
        throw new Error("INVALID_ACCOUNT_SAVE");
      }
      return saved.progress;
    },
    saveNow(progress) {
      const owner = currentOwner();
      if (!validProgress(progress)) throw new Error("INVALID_ACCOUNT_SAVE");
      const raw = JSON.stringify(envelope(owner, progress));
      commit(owner, raw);
    },
    async save(progress) {
      const owner = currentOwner();
      const snapshot = structuredClone(progress);
      if (!validProgress(snapshot)) throw new Error("INVALID_ACCOUNT_SAVE");
      const raw = await serialize(envelope(owner, snapshot));
      if (typeof raw !== "string") throw new Error("INVALID_ACCOUNT_SAVE");
      commit(owner, raw); // stale Exit save must reject; SDK must not close
    },
  };
}
