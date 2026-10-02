import test from "node:test";
import assert from "node:assert/strict";
import { snapshotDecision, snapshotKey } from "./nightly_snapshot.js";

test("a completed daily archive is not uploaded again", () => {
  const firstRun = snapshotKey("2026-09-15");
  const retry = snapshotKey("2026-09-15");
  assert.equal(firstRun, "storefront-devtools/2026-09-15.json");
  assert.equal(retry, firstRun);
  assert.equal(snapshotDecision(true), "already-recorded");
  assert.equal(snapshotDecision(false), "uploaded");
});
