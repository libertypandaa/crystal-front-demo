import { writeVerifiedJson } from "../src/presentation/browser/lpaFoundation.js";
const PRODUCT_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SAVE_SCHEMA = 1;

// Isolated commerce tests only. Production purchase awaits approved consume/revision APIs.
// The public game never creates a namespace from a launch ID, nickname, or analytics session.
export function createAccountSaveStore(storage, namespace) {
  if (typeof namespace !== "string" || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(namespace)) {
    throw new Error("ACCOUNT_NAMESPACE_REQUIRED");
  }
  const key = `crystalFrontAccountV1:${namespace}`;
  const fresh = () => ({ schema: SAVE_SCHEMA, namespace, progress: null, pending: null, appliedGrantIds: [], pilotBombs: 0 });
  function load() {
    const raw = storage.getItem(key);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (data?.schema !== SAVE_SCHEMA || data.namespace !== namespace || !Array.isArray(data.appliedGrantIds)
      || !Number.isSafeInteger(data.pilotBombs) || data.pilotBombs < 0) throw new Error("INVALID_ACCOUNT_SAVE");
    return data;
  }
  function save(data) {
    if (data?.schema !== SAVE_SCHEMA || data.namespace !== namespace) throw new Error("INVALID_ACCOUNT_SAVE");
    writeVerifiedJson(storage, key, data);
    return data;
  }
  function beginPurchase(operationId, productId) {
    if (!UUID.test(operationId) || !PRODUCT_ID.test(productId)) throw new Error("INVALID_PURCHASE");
    const data = load();
    if (data.pending && (data.pending.operationId !== operationId || data.pending.productId !== productId)) {
      throw new Error("PURCHASE_PENDING");
    }
    return save({ ...data, pending: { operationId, productId } });
  }
  function applyReceipt(operationId, productId, grant) {
    const data = load();
    if (data.appliedGrantIds.includes(grant?.id)) return data;
    if (!data.pending) throw new Error("PURCHASE_NOT_PENDING");
    if (data.pending && (data.pending.operationId !== operationId || data.pending.productId !== productId)) {
      throw new Error("PURCHASE_MISMATCH");
    }
    if (productId !== "cf.bomb.single" || typeof grant?.id !== "string" || !grant.id
      || grant.itemId !== "bomb" || grant.quantity !== 1) throw new Error("INVALID_GRANT");
    // Count and processed grant ID are written in one envelope; receipt replay is a no-op.
    return save({ ...data, pending: null, appliedGrantIds: [...data.appliedGrantIds, grant.id], pilotBombs: data.pilotBombs + 1 });
  }
  return { key, load, save, beginPurchase, applyReceipt };
}
