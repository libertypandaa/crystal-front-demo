import assert from "node:assert/strict";
import { createAccountProgressAdapter, createTelemetry, readEconomy, writeVerifiedJson } from "../src/presentation/browser/lpaFoundation.js";
import { createAccountSaveStore } from "./fake-commerce.mjs";

const operationId = "11111111-1111-4111-8111-111111111111";
const otherOperationId = "22222222-2222-4222-8222-222222222222";
const productId = "cf.bomb.single";
const grant = { id: "grant-1", itemId: "bomb", quantity: 1 };

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

const events = [];
const telemetry = createTelemetry({
  ready: () => events.push("ready"),
  setPlaying: value => events.push(["playing", value]),
  matchStart: mode => { events.push(["start", mode]); return operationId; },
  matchEnd: (id, outcome, score) => { events.push(["end", id, outcome, score]); return true; },
});
telemetry.ready();
telemetry.matchStart("target_score");
telemetry.setPlaying(true);
telemetry.setPlaying(false); // pause or hidden tab
assert.equal(telemetry.matchEnd("win", 50), true);
assert.equal(telemetry.matchEnd("win", 50), false);
assert.deepEqual(events, ["ready", ["start", "target_score"], ["playing", true], ["playing", false], ["playing", false], ["end", operationId, "win", 50]]);
telemetry.matchStart("ai_duel");
telemetry.matchStart("target_score"); // restart abandons prior match once
assert.equal(events.filter(event => Array.isArray(event) && event[2] === "abandon").length, 1);
assert.doesNotThrow(() => {
  const refused = createTelemetry({ matchStart: () => null, setPlaying: () => { throw Error("offline"); } });
  refused.matchStart("target_score");
  refused.setPlaying(true);
  refused.matchEnd("loss", 0);
});

assert.deepEqual(await readEconomy(null), { status: "unavailable" });
assert.deepEqual(await readEconomy({ ready: Promise.resolve(false) }), { status: "unavailable" });
const failed = await readEconomy({ ready: Promise.resolve(true), available: () => true, capabilities: async () => { throw Error("OFFLINE"); } });
assert.deepEqual(failed, { status: "error", code: "OFFLINE" });
const calls = [];
const economy = await readEconomy({
  ready: Promise.resolve(true), available: () => true,
  capabilities: async () => { calls.push("capabilities"); return { spendEnabled: false, providers: false }; },
  wallet: async () => { calls.push("wallet"); return { balance: 0, currency: "TEST" }; },
  catalog: async () => { calls.push("catalog"); return []; },
  inventory: async () => { calls.push("inventory"); return []; },
  purchase: () => { throw Error("purchase must never be called by read adapter"); },
});
assert.equal(economy.status, "ready");
assert.equal(economy.wallet.balance, 0); // real zero only after successful wallet read
assert.deepEqual(calls.sort(), ["capabilities", "catalog", "inventory", "wallet"]);

assert.throws(() => createAccountSaveStore(memoryStorage(), null), /ACCOUNT_NAMESPACE_REQUIRED/);
const storage = memoryStorage();
storage.setItem("crystalFrontProgressV1", "legacy-backup");
const accountA = createAccountSaveStore(storage, "fixture-account-A:crystal-front-demo");
const accountB = createAccountSaveStore(storage, "fixture-account-B:crystal-front-demo");
accountA.beginPurchase(operationId, productId);
assert.deepEqual(accountA.load().pending, { operationId, productId });
assert.equal(accountB.load().pending, null); // no cross-account pending operation
assert.throws(() => accountA.beginPurchase(otherOperationId, productId), /PURCHASE_PENDING/);
accountA.beginPurchase(operationId, productId); // lost response: same ID remains safe to retry
assert.deepEqual(accountA.load().pending, { operationId, productId });
assert.throws(() => accountA.applyReceipt(otherOperationId, productId, grant), /PURCHASE_MISMATCH/);
accountA.applyReceipt(operationId, productId, grant);
assert.equal(accountA.load().pilotBombs, 1);
assert.equal(createAccountSaveStore(storage, "fixture-account-A:crystal-front-demo").applyReceipt(operationId, productId, grant).pilotBombs, 1);
assert.equal(accountB.load().pilotBombs, 0);
assert.equal(storage.getItem("crystalFrontProgressV1"), "legacy-backup");

// Fake transport only: the official SDK does not enable a production purchase.
const purchaseTransport = (() => {
  const accepted = new Map();
  let debitCount = 0;
  let dropFirstResponse = true;
  return {
    get debitCount() { return debitCount; },
    async purchase(requestedProduct, requestedOperation) {
      if (requestedOperation === otherOperationId) throw new Error("PRICE_CHANGED");
      if (!accepted.has(requestedOperation)) {
        debitCount += 1;
        accepted.set(requestedOperation, { operationId: requestedOperation, productId: requestedProduct,
          grant: { id: `grant-${requestedOperation}`, itemId: "bomb", quantity: 1 } });
      }
      if (dropFirstResponse) { dropFirstResponse = false; throw new Error("RESPONSE_LOST"); }
      return accepted.get(requestedOperation);
    },
  };
})();
const retryStorage = memoryStorage();
const firstSession = createAccountSaveStore(retryStorage, "fixture-pending-account");
firstSession.beginPurchase(operationId, productId);
await assert.rejects(purchaseTransport.purchase(productId, operationId), /RESPONSE_LOST/);
const reopenedSession = createAccountSaveStore(retryStorage, "fixture-pending-account");
assert.deepEqual(reopenedSession.load().pending, { operationId, productId });
const recovered = await purchaseTransport.purchase(reopenedSession.load().pending.productId, reopenedSession.load().pending.operationId);
reopenedSession.applyReceipt(recovered.operationId, recovered.productId, recovered.grant);
reopenedSession.applyReceipt(recovered.operationId, recovered.productId, recovered.grant);
assert.equal(reopenedSession.load().pilotBombs, 1);
assert.equal(purchaseTransport.debitCount, 1);
const quoted = createAccountSaveStore(memoryStorage(), "fixture-price-account");
quoted.beginPurchase(otherOperationId, productId);
await assert.rejects(purchaseTransport.purchase(productId, otherOperationId), /PRICE_CHANGED/);
assert.deepEqual(quoted.load().pending, { operationId: otherOperationId, productId });
assert.equal(quoted.load().pilotBombs, 0);
assert.equal(purchaseTransport.debitCount, 1);

const denied = { getItem: () => null, setItem: () => { throw Error("QUOTA"); } };
assert.throws(() => writeVerifiedJson(denied, "x", { data: 1 }), /QUOTA/);
assert.throws(() => createAccountSaveStore(denied, "fixture-A").beginPurchase(operationId, productId), /QUOTA/);
const lostReadback = { getItem: () => null, setItem: () => {} };
assert.throws(() => writeVerifiedJson(lostReadback, "x", { data: 1 }), /STORAGE_UNAVAILABLE/);

const aNamespace = `lpa:save:v1:${"a".repeat(64)}`;
const bNamespace = `lpa:save:v1:${"b".repeat(64)}`;
let context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: aNamespace, generation: 1 };
const platform = {
  accountContext: () => context,
  isAccountContextCurrent: owner => owner === context && owner.status === "ready",
};
const accountStorage = memoryStorage();
const progressAdapter = createAccountProgressAdapter(platform, accountStorage);
const progress = rays => ({ profile: { nickname: "Player", nicknameSet: true, rays }, bonuses: { bomb: 3, line: 3, mix: 2, color: 2 }, shop: { lastAdClaimAt: 0 } });
progressAdapter.saveNow(progress(11));
assert.equal(progressAdapter.read().profile.rays, 11);
context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: bNamespace, generation: 2 };
assert.equal(progressAdapter.read(), null);
progressAdapter.saveNow(progress(22));
assert.equal(progressAdapter.read().profile.rays, 22);
context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: aNamespace, generation: 3 };
assert.equal(progressAdapter.read().profile.rays, 11);

let releaseSerialization;
const delayed = createAccountProgressAdapter(platform, accountStorage, value => new Promise(resolve => {
  releaseSerialization = () => resolve(JSON.stringify(value));
}));
const staleExitSave = delayed.save(progress(99));
context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: bNamespace, generation: 4 };
context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: aNamespace, generation: 5 }; // A→B→A
releaseSerialization();
await assert.rejects(staleExitSave, /ACCOUNT_CONTEXT_CHANGED/);
assert.equal(progressAdapter.read().profile.rays, 11); // old A1 cannot overwrite A2
context = { status: "expired", gameId: "crystal-front-demo", storageNamespace: null, generation: 6 };
assert.throws(() => progressAdapter.read(), /ACCOUNT_CONTEXT_CHANGED/);
await assert.rejects(progressAdapter.save(progress(44)), /ACCOUNT_CONTEXT_CHANGED/);
context = { status: "ready", gameId: "crystal-front-demo", storageNamespace: aNamespace, generation: 7 };
const deniedAdapter = createAccountProgressAdapter(platform, denied);
await assert.rejects(deniedAdapter.save(progress(44)), /QUOTA/);
assert.throws(() => progressAdapter.saveNow({}), /INVALID_ACCOUNT_SAVE/);
const accountKey = `${aNamespace}:crystalFrontProgress:v1`;
const validRaw = accountStorage.getItem(accountKey);
for (const malformed of [
  { schema: 2, gameId: "crystal-front-demo", progress: progress(11) },
  { schema: 1, gameId: "crystal-front-demo", progress: {} },
  { schema: 1, gameId: "crystal-front-demo", progress: [] },
]) {
  accountStorage.setItem(accountKey, JSON.stringify(malformed));
  assert.throws(() => progressAdapter.read(), /INVALID_ACCOUNT_SAVE/);
  assert.equal(accountStorage.getItem(accountKey), JSON.stringify(malformed));
}
accountStorage.setItem(accountKey, validRaw);
assert.equal(storage.getItem("crystalFrontProgressV1"), "legacy-backup");

console.log("LPA foundation adapters ok (local mocks only)");
