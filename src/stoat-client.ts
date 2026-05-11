import type { StoatPayload } from "./message-builder.js";

export interface SendOptions {
  timeoutMs: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

export class WebhookError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

export async function sendStoatWebhook(
  payload: StoatPayload,
  webhookUrl: string,
  options: SendOptions,
): Promise<{ attempts: number }> {
  const fetchFn = options.fetchFn || fetch;
  const sleepFn = options.sleepFn || sleep;

  const response = await postPayload(fetchFn, webhookUrl, payload, options.timeoutMs);

  if (response.status === 429) {
    const retryAfter = await readRetryAfter(response);
    await sleepFn(retryAfter);

    const retryResponse = await postPayload(fetchFn, webhookUrl, payload, options.timeoutMs);
    if (!retryResponse.ok) {
      throw new WebhookError(await buildFailureMessage(retryResponse), 2);
    }

    return { attempts: 2 };
  }

  if (!response.ok) {
    throw new WebhookError(await buildFailureMessage(response), 1);
  }

  return { attempts: 1 };
}

async function postPayload(
  fetchFn: typeof fetch,
  webhookUrl: string,
  payload: StoatPayload,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readRetryAfter(response: Response): Promise<number> {
  try {
    const body = (await response.json()) as { retry_after?: number };
    const retryAfter = body.retry_after || 1000;

    return retryAfter < 100 ? retryAfter * 1000 : retryAfter;
  } catch {
    return 1000;
  }
}

async function buildFailureMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");

  return `Stoat notification failed: ${response.status}${body ? ` ${body}` : ""}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
