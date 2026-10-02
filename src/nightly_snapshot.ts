import { createHash } from "node:crypto";
import { InfraiError, infrai } from "./infrai_storage.js";

export type DeveloperToolsSnapshot = {
  snapshotDate: string;
  buildEvents: Array<{ storefront: string; buildId: string; status: "passed" | "failed" }>;
  releases: Array<{ storefront: string; releaseId: string; channel: "preview" | "live" }>;
  diagnostics: Array<{ storefront: string; message: string; severity: "info" | "warning" | "error" }>;
};

export type SnapshotResult = {
  state: "uploaded" | "already-recorded";
  key: string;
};

export function snapshotKey(snapshotDate: string): string {
  return `storefront-devtools/${snapshotDate}.json`;
}

export function encodeSnapshot(snapshot: DeveloperToolsSnapshot): string {
  return Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64");
}

export function snapshotDecision(found: boolean): SnapshotResult["state"] {
  return found ? "already-recorded" : "uploaded";
}

export async function ensureSnapshotBucket(bucket: string): Promise<void> {
  try {
    await infrai.storage.bucket.get(bucket);
  } catch (error) {
    if (error instanceof InfraiError && error.status === 404) {
      await infrai.storage.bucket.create({ name: bucket });
      return;
    }
    throw error;
  }
}

export async function recordNightlySnapshot(
  bucket: string,
  snapshot: DeveloperToolsSnapshot,
): Promise<SnapshotResult> {
  await ensureSnapshotBucket(bucket);
  const key = snapshotKey(snapshot.snapshotDate);
  const head = await infrai.storage.object.head(bucket, key);
  if (snapshotDecision(head.found) === "already-recorded") {
    return { state: "already-recorded", key };
  }

  const payload = encodeSnapshot(snapshot);
  const idempotencyKey = createHash("sha256").update(`${key}:${payload}`).digest("hex");
  const signed = await infrai.storage.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 300,
    content_type: "application/json",
    max_bytes: Buffer.byteLength(payload, "utf8"),
    idempotency_key: idempotencyKey,
  });
  const uploaded = await fetch(signed.url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: Buffer.from(payload, "base64"),
  });
  if (!uploaded.ok) throw new Error("Snapshot upload did not complete.");
  return { state: "uploaded", key };
}
