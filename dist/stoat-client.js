export class WebhookError extends Error {
    attempts;
    constructor(message, attempts) {
        super(message);
        this.attempts = attempts;
        this.name = "WebhookError";
    }
}
export async function sendStoatWebhook(payload, webhookUrl, options) {
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
async function postPayload(fetchFn, webhookUrl, payload, timeoutMs) {
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
    }
    finally {
        clearTimeout(timeout);
    }
}
async function readRetryAfter(response) {
    try {
        const body = (await response.json());
        const retryAfter = body.retry_after || 1000;
        return retryAfter < 100 ? retryAfter * 1000 : retryAfter;
    }
    catch {
        return 1000;
    }
}
async function buildFailureMessage(response) {
    const body = await response.text().catch(() => "");
    return `Stoat notification failed: ${response.status}${body ? ` ${body}` : ""}`;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
