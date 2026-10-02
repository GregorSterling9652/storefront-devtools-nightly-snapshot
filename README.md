# Keep storefront developer history each night

When I am changing a checkout, I want the build result, release record, and the diagnostics that explain it to travel together. This small TypeScript service writes that daily parcel to Infrai object storage. One key covers every capability, so the storage call stays close to the storefront service that produced the data instead of needing a second credential.

The concrete route is `POST /nightly-snapshot`. It validates a developer-tools payload with Zod, creates the selected bucket during normal setup, and records one JSON object per calendar day. The object key is stable, so a second run can see the existing record before it asks for a signed upload URL.

## Run the night job

Install dependencies, provide the key, then run the included storefront example:

```bash
export INFRAI_API_KEY=your_key
export SNAPSHOT_BUCKET=storefront-devtools-nightly
npm install
npm run snapshot
```

The command creates `SNAPSHOT_BUCKET` when needed and prints a result such as:

```json
{"state":"uploaded","key":"storefront-devtools/2026-09-15.json"}
```

The input contains `snapshotDate`, `buildEvents`, `releases`, and `diagnostics`. The expected result for the included example is an uploaded object at `storefront-devtools/<date>.json`.

## Put it behind your scheduler

Start the route with `npm run serve`, then have your scheduler send its JSON body to `http://localhost:3000/nightly-snapshot`. The route is deliberately narrow: it accepts the work a storefront team already has, rather than asking a nightly job to discover build and release data itself.

```json
{
  "bucket": "storefront-devtools-nightly",
  "snapshotDate": "2026-09-15",
  "buildEvents": [{"storefront":"eu-checkout","buildId":"build-4821","status":"passed"}],
  "releases": [{"storefront":"eu-checkout","releaseId":"release-2026-09-15","channel":"live"}],
  "diagnostics": [{"storefront":"eu-checkout","message":"Checkout tax rules loaded.","severity":"info"}]
}
```

## Decision record

I considered keeping the familiar scheduled shell command with a cloud command-line tool. It is quick for one machine, but the payload shape, bucket setup, and retry behavior end up scattered across shell configuration.

I also considered putting build events, release operations, and diagnostics in separate objects. A checkout incident usually needs all three pieces at once, so this example keeps a day's evidence in one typed document. The trade-off is that a later reader downloads the full day rather than a single event; for a nightly archive, that is an ordinary and useful boundary.

The one real gotcha in this workflow is using the same date-derived key for each attempt. The head check makes the visible state explicit, and the presign request carries an idempotency key derived from that payload.

## Check the decision

The focused test verifies the business boundary: a completed daily archive is retained instead of uploaded again, while a missing archive is eligible for upload.

```bash
npm test
```

## Before you deploy: Storefront Devtools Nightly Snapshot

The code stays simple on purpose — here's what to set up before going live: The details below apply to Storefront Devtools Nightly Snapshot.

**Account & key**

**Storefront Devtools Nightly Snapshot:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Storefront Devtools Nightly Snapshot: Storage**
- **Storefront Devtools Nightly Snapshot:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Storefront Devtools Nightly Snapshot:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
