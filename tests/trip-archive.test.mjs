import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_TRIP_BACKUP_KEY,
  backupLegacyTripRaw,
  canExportTripFile,
  captureTripArchiveSnapshot,
  clearTripArchive,
  createLazyStorageAdapter,
  finalizeLegacyMigration,
  isLegacyTripPayload,
  legacyMigrationPending,
  readTripRecoveryCandidates,
  restoreTripArchiveSnapshot,
  safeTripNameForFile,
  shareUrlForTrip,
  tripFileExportPayload,
  tripFileName,
  tripFileText,
  writeTripPlanV2
} from "../public/static-site/trip-archive.js";
import {
  LEGACY_TRIP_STORAGE_KEY,
  TRIP_STORAGE_KEY,
  compactTripPlan,
  createTripPlan
} from "../public/static-site/trip-plan.js";

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.failGet = new Set();
    this.failSet = new Set();
    this.failRemove = new Set();
  }

  getItem(key) {
    if (this.failGet.has(key)) throw Object.assign(new Error("storage read denied"), { name: "SecurityError" });
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet.has(key)) throw Object.assign(new Error("storage quota exceeded"), { name: "QuotaExceededError" });
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.failRemove.has(key)) throw Object.assign(new Error("storage removal denied"), { name: "SecurityError" });
    this.values.delete(key);
  }
}

function fixedPlan(name = "周末行程") {
  return createTripPlan({
    name,
    placeIds: ["beijing"],
    transportMode: "train",
    idFactory: (() => {
      let value = 0;
      return (prefix) => `${prefix}-${++value}`;
    })()
  });
}

test("recovery candidates keep hash, v2 and v1 priority while isolating storage read errors", () => {
  const v2 = JSON.stringify({ version: 2, id: "stored", days: [] });
  const v1 = JSON.stringify({ selectedCityId: "wuhan" });
  const hash = JSON.stringify({ version: 2, id: "shared", days: [] });
  const storage = new MemoryStorage({
    [TRIP_STORAGE_KEY]: v2,
    [LEGACY_TRIP_STORAGE_KEY]: v1
  });

  const candidates = readTripRecoveryCandidates({
    storage,
    currentUrl: `https://example.test/planner#trip=${encodeURIComponent(hash)}`
  });
  assert.deepEqual(candidates.map(({ source }) => source), ["hash", "storage", "legacy"]);
  assert.equal(candidates[0].raw, hash);
  assert.equal(candidates[1].raw, v2);
  assert.equal(candidates[2].raw, v1);

  storage.failGet.add(TRIP_STORAGE_KEY);
  const withFailure = readTripRecoveryCandidates({ storage, currentUrl: "https://example.test/planner" });
  assert.deepEqual(withFailure.map(({ source }) => source), ["storage", "legacy"]);
  assert.equal(withFailure[0].error.name, "SecurityError");
  assert.equal(withFailure[1].raw, v1);
});

test("lazy storage adapter defers and contains a throwing localStorage getter", () => {
  const denied = Object.assign(new Error("localStorage getter denied"), { name: "SecurityError" });
  const storageOwner = {};
  let getterReads = 0;
  Object.defineProperty(storageOwner, "localStorage", {
    get() {
      getterReads += 1;
      throw denied;
    }
  });

  const storage = createLazyStorageAdapter(() => storageOwner.localStorage);
  assert.equal(getterReads, 0);

  const hashPlan = JSON.stringify({ version: 2, id: "shared", days: [] });
  const candidates = readTripRecoveryCandidates({
    storage,
    currentUrl: `https://example.test/planner#trip=${encodeURIComponent(hashPlan)}`
  });
  assert.deepEqual(candidates.map(({ source }) => source), ["hash", "storage", "legacy"]);
  assert.equal(candidates[0].raw, hashPlan);
  assert.equal(candidates[1].error, denied);
  assert.equal(candidates[2].error, denied);
  assert.equal(getterReads, 2);

  const replacements = [];
  const writeResult = writeTripPlanV2({
    storage,
    plan: fixedPlan(),
    currentUrl: "https://example.test/planner#trip=keep-me",
    replaceUrl: (nextUrl) => replacements.push(nextUrl)
  });
  assert.equal(writeResult.stored, false);
  assert.equal(writeResult.error, denied);
  assert.deepEqual(replacements, []);
  assert.equal(getterReads, 3);
});

test("a successful v2 write retires the trip hash before future recovery", () => {
  const previous = JSON.stringify({ version: 2, id: "previous", days: [] });
  const storage = new MemoryStorage({ [TRIP_STORAGE_KEY]: previous });
  const plan = fixedPlan();
  let currentUrl = "https://example.test/planner?view=calendar#tab=map&trip=stale";
  const replacements = [];

  const result = writeTripPlanV2({
    storage,
    plan,
    currentUrl,
    replaceUrl(nextUrl) {
      replacements.push(nextUrl);
      currentUrl = nextUrl;
    }
  });

  assert.equal(result.stored, true);
  assert.equal(result.hashCleared, true);
  assert.equal(replacements.length, 1);
  assert.equal(new URL(currentUrl).hash, "#tab=map");
  assert.deepEqual(JSON.parse(storage.getItem(TRIP_STORAGE_KEY)), plan);

  const candidates = readTripRecoveryCandidates({ storage, currentUrl });
  assert.equal(candidates[0].source, "storage");
  assert.equal(JSON.parse(candidates[0].raw).id, plan.id);
});

test("a failed v2 write preserves both the previous storage value and trip hash", () => {
  const previous = JSON.stringify({ version: 2, id: "previous", days: [] });
  const storage = new MemoryStorage({ [TRIP_STORAGE_KEY]: previous });
  storage.failSet.add(TRIP_STORAGE_KEY);
  const currentUrl = "https://example.test/planner#trip=stale";
  const replacements = [];

  const result = writeTripPlanV2({
    storage,
    plan: fixedPlan(),
    currentUrl,
    replaceUrl: (nextUrl) => replacements.push(nextUrl)
  });

  assert.equal(result.stored, false);
  assert.equal(result.hashCleared, false);
  assert.equal(result.error.name, "QuotaExceededError");
  assert.equal(storage.getItem(TRIP_STORAGE_KEY), previous);
  assert.deepEqual(replacements, []);
  assert.equal(new URL(currentUrl).hash, "#trip=stale");
});

test("a hash replacement failure is reported after the v2 write succeeds", () => {
  const storage = new MemoryStorage();
  const plan = fixedPlan();
  const result = writeTripPlanV2({
    storage,
    plan,
    currentUrl: "https://example.test/planner#trip=stale",
    replaceUrl() {
      throw Object.assign(new Error("history denied"), { name: "SecurityError" });
    }
  });

  assert.equal(result.stored, true);
  assert.equal(result.hashCleared, false);
  assert.equal(result.error.name, "SecurityError");
  assert.deepEqual(JSON.parse(storage.getItem(TRIP_STORAGE_KEY)), plan);
});

test("legacy backup stores exact source text and reports quota failures without mutation", () => {
  const storage = new MemoryStorage({ [LEGACY_TRIP_BACKUP_KEY]: "previous backup" });
  const raw = "{\n  \"routes\": [{\"from\":\"beijing\",\"to\":\"wuhan\"}]\n}";
  assert.equal(backupLegacyTripRaw({ storage, raw }).ok, true);
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), raw);

  storage.failSet.add(LEGACY_TRIP_BACKUP_KEY);
  const failed = backupLegacyTripRaw({ storage, raw: "replacement" });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.name, "QuotaExceededError");
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), raw);
});

test("legacy finalization retires both v1 records and stays pending after any removal failure", () => {
  const storage = new MemoryStorage({
    [LEGACY_TRIP_STORAGE_KEY]: "legacy",
    [LEGACY_TRIP_BACKUP_KEY]: "backup"
  });
  const complete = finalizeLegacyMigration({ storage });
  assert.equal(complete.ok, true);
  assert.equal(storage.getItem(LEGACY_TRIP_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), null);

  storage.setItem(LEGACY_TRIP_STORAGE_KEY, "legacy");
  storage.setItem(LEGACY_TRIP_BACKUP_KEY, "backup");
  storage.failRemove.add(LEGACY_TRIP_BACKUP_KEY);
  const partial = finalizeLegacyMigration({ storage });
  assert.equal(partial.ok, false);
  assert.deepEqual(partial.failedKeys, [LEGACY_TRIP_BACKUP_KEY]);
  assert.equal(storage.getItem(LEGACY_TRIP_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), "backup");

  storage.failRemove.delete(LEGACY_TRIP_BACKUP_KEY);
  storage.setItem(LEGACY_TRIP_STORAGE_KEY, "legacy");
  storage.setItem(LEGACY_TRIP_BACKUP_KEY, "backup");
  storage.failRemove.add(LEGACY_TRIP_STORAGE_KEY);
  const blockedAtV1 = finalizeLegacyMigration({ storage });
  assert.equal(blockedAtV1.ok, false);
  assert.deepEqual(blockedAtV1.failedKeys, [LEGACY_TRIP_STORAGE_KEY]);
  assert.equal(storage.getItem(LEGACY_TRIP_STORAGE_KEY), "legacy");
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), "backup");
});

test("legacy migration pending survives reload only when the migration backup marker remains", () => {
  const storage = new MemoryStorage();
  assert.equal(legacyMigrationPending({ storage }), false);
  storage.setItem(LEGACY_TRIP_STORAGE_KEY, "legacy");
  assert.equal(legacyMigrationPending({ storage }), false);
  storage.setItem(LEGACY_TRIP_BACKUP_KEY, "backup");
  assert.equal(legacyMigrationPending({ storage }), true);

  storage.failGet.add(LEGACY_TRIP_BACKUP_KEY);
  assert.throws(() => legacyMigrationPending({ storage }), { name: "SecurityError" });
});

test("clear removes v2, v1, backup and trip hash while exposing partial failures", () => {
  const storage = new MemoryStorage({
    [TRIP_STORAGE_KEY]: "v2",
    [LEGACY_TRIP_STORAGE_KEY]: "v1",
    [LEGACY_TRIP_BACKUP_KEY]: "backup"
  });
  let currentUrl = "https://example.test/planner#trip=shared";
  const cleared = clearTripArchive({
    storage,
    currentUrl,
    replaceUrl(nextUrl) {
      currentUrl = nextUrl;
    }
  });
  assert.equal(cleared.ok, true);
  assert.equal(storage.getItem(TRIP_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_TRIP_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), null);
  assert.equal(new URL(currentUrl).hash, "");

  storage.setItem(LEGACY_TRIP_STORAGE_KEY, "v1");
  storage.failRemove.add(LEGACY_TRIP_STORAGE_KEY);
  const partial = clearTripArchive({
    storage,
    currentUrl: "https://example.test/planner#trip=shared",
    replaceUrl() {
      throw new Error("history denied");
    }
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.hashCleared, false);
  assert.deepEqual(partial.failedKeys, [LEGACY_TRIP_STORAGE_KEY]);
});

test("archive snapshots restore exact values and report rollback storage failures", () => {
  const storage = new MemoryStorage({
    [TRIP_STORAGE_KEY]: "before-v2",
    [LEGACY_TRIP_BACKUP_KEY]: "before-backup"
  });
  const snapshot = captureTripArchiveSnapshot({ storage });
  storage.setItem(TRIP_STORAGE_KEY, "after-v2");
  storage.removeItem(LEGACY_TRIP_BACKUP_KEY);

  const restored = restoreTripArchiveSnapshot({ storage, snapshot });
  assert.equal(restored.ok, true);
  assert.equal(storage.getItem(TRIP_STORAGE_KEY), "before-v2");
  assert.equal(storage.getItem(LEGACY_TRIP_BACKUP_KEY), "before-backup");

  storage.setItem(TRIP_STORAGE_KEY, "after-again");
  storage.failSet.add(TRIP_STORAGE_KEY);
  const failed = restoreTripArchiveSnapshot({
    storage,
    snapshot,
    keys: [TRIP_STORAGE_KEY]
  });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.failedKeys, [TRIP_STORAGE_KEY]);
  assert.equal(storage.getItem(TRIP_STORAGE_KEY), "after-again");
});

test("legacy payload detection requires a v1 version and legacy snapshot shape", () => {
  assert.equal(isLegacyTripPayload({ routes: [] }), true);
  assert.equal(isLegacyTripPayload({ version: 1, selectedCityId: "wuhan" }), true);
  assert.equal(isLegacyTripPayload({ version: 2, routes: [] }), false);
  assert.equal(isLegacyTripPayload({ version: 1, days: [] }), false);
  assert.equal(isLegacyTripPayload(null), false);
});

test("share URLs use compact plans and trip file exports use safe readable names", () => {
  const plan = fixedPlan("南京 / 周末");
  const shareUrl = shareUrlForTrip(plan, "https://example.test/planner?view=calendar#tab=map");
  const params = new URLSearchParams(new URL(shareUrl).hash.slice(1));
  assert.deepEqual(JSON.parse(params.get("trip")), compactTripPlan(plan));

  const timestamp = new Date("2026-07-14T03:04:05.678Z");
  assert.equal(tripFileName(plan, timestamp), "南京-周末-2026-07-14T03-04-05-678Z.trip.json");
  assert.equal(tripFileText(plan), `${JSON.stringify(compactTripPlan(plan), null, 2)}\n`);
  assert.equal(safeTripNameForFile("CON"), "trip");
  assert.equal(safeTripNameForFile("<>:\"/\\|?*"), "trip");
});

test("trip file export availability includes a validated emergency legacy source", () => {
  const raw = '{\n  "name": "Legacy / Beijing",\n  "routes": [{"from":"beijing","to":"wuhan"}]\n}\n';
  assert.equal(canExportTripFile({ plan: null, emergencyLegacyRaw: null }), false);
  assert.equal(tripFileExportPayload({ plan: null, emergencyLegacyRaw: null }), null);
  assert.equal(canExportTripFile({ plan: null, emergencyLegacyRaw: raw }), true);
  assert.equal(canExportTripFile({ plan: null, emergencyLegacyRaw: "not json" }), false);
});

test("emergency legacy export preserves exact importable source and takes priority over v2", () => {
  const raw = '{\n  "name": "Legacy / Beijing",\n  "routes": [{"from":"beijing","to":"wuhan"}]\n}\n';
  const timestamp = new Date("2026-07-14T03:04:05.678Z");
  const payload = tripFileExportPayload({
    plan: fixedPlan("Current trip"),
    emergencyLegacyRaw: raw,
    timestamp
  });

  assert.equal(payload.kind, "legacy-emergency");
  assert.equal(payload.text, raw);
  assert.equal(payload.filename, "Legacy-Beijing-2026-07-14T03-04-05-678Z.trip.json");
  assert.equal(isLegacyTripPayload(JSON.parse(payload.text)), true);

  const regular = tripFileExportPayload({
    plan: fixedPlan("Current trip"),
    emergencyLegacyRaw: null,
    timestamp
  });
  assert.equal(regular.kind, "trip-plan");
  assert.equal(regular.filename, "Current-trip-2026-07-14T03-04-05-678Z.trip.json");
  assert.equal(JSON.parse(regular.text).version, 2);
});

test("safe trip names truncate by Unicode code point without creating lone surrogates", () => {
  const supplementaryLetter = "\u{10400}";
  const safe = safeTripNameForFile(`${"a".repeat(59)}${supplementaryLetter}tail`);
  assert.equal(Array.from(safe).length, 60);
  assert.equal(safe.endsWith(supplementaryLetter), true);
  assert.doesNotMatch(safe, /[\uD800-\uDFFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);
});
