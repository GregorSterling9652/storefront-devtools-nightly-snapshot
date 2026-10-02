import { recordNightlySnapshot, type DeveloperToolsSnapshot } from "./nightly_snapshot.js";

const snapshot: DeveloperToolsSnapshot = {
  snapshotDate: new Date().toISOString().slice(0, 10),
  buildEvents: [{ storefront: "eu-checkout", buildId: "build-4821", status: "passed" }],
  releases: [{ storefront: "eu-checkout", releaseId: "release-2026-09-15", channel: "live" }],
  diagnostics: [{ storefront: "eu-checkout", message: "Checkout tax rules loaded.", severity: "info" }],
};

const bucket = process.env.SNAPSHOT_BUCKET ?? "storefront-devtools-nightly";
recordNightlySnapshot(bucket, snapshot)
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
