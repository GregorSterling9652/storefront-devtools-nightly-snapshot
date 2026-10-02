import { createServer } from "node:http";
import { z } from "zod";
import { recordNightlySnapshot } from "./nightly_snapshot.js";

const SnapshotRequest = z.object({
  bucket: z.string().min(3),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buildEvents: z.array(z.object({ storefront: z.string(), buildId: z.string(), status: z.enum(["passed", "failed"]) })),
  releases: z.array(z.object({ storefront: z.string(), releaseId: z.string(), channel: z.enum(["preview", "live"]) })),
  diagnostics: z.array(z.object({ storefront: z.string(), message: z.string(), severity: z.enum(["info", "warning", "error"]) })),
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/nightly-snapshot") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "Use POST /nightly-snapshot." }));
    return;
  }
  const parsed = SnapshotRequest.safeParse(await readJson(request));
  if (!parsed.success) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ issues: parsed.error.issues }));
    return;
  }
  try {
    const result = await recordNightlySnapshot(parsed.data.bucket, parsed.data);
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(422, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : "Snapshot was rejected." }));
  }
});

server.listen(Number(process.env.PORT ?? 3000));
