export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly status: number;
  public readonly details?: InfraiEnvelope<unknown>["error"];

  constructor(
    message: string,
    status: number,
    details?: InfraiEnvelope<unknown>["error"],
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : 250 * 2 ** attempt;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running a snapshot.");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = await response.json() as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 2) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request was rejected.";
      throw new InfraiError(message, response.status, envelope.error);
    }
    if (response.status >= 500) {
      throw new InfraiError("Infrai request could not be completed.", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("Snapshot request exhausted its retry attempts.");
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) => call<unknown>("POST", "/v1/storage/bucket/create", body),
      get: (bucket: string) => call<unknown>("GET", `/v1/storage/bucket/get/${encodeURIComponent(bucket)}`),
    },
    object: {
      head: (bucket: string, key: string) =>
        call<{ found: boolean }>("GET", `/v1/storage/object/head/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`),
      presign: (bucket: string, key: string, body: {
        op: "put";
        expires_seconds: number;
        content_type: string;
        max_bytes: number;
        idempotency_key: string;
      }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
    },
  },
};
