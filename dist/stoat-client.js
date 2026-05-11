export async function sendStoatWebhook(payload, webhookUrl, options) {
    const fetchFn = options.fetchFn || fetch;
    const sleepFn = options.sleepFn || sleep;
    const maxAttempts = 1 + options.retryCount;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const response = await postPayload(fetchFn, webhookUrl, payload, options.timeoutMs);
        if (response.ok) {
            return attempt;
        }
        if (response.status === 429 && attempt < maxAttempts) {
            const delay = await readRetryAfter(response, options.retryDelayMs);
            await sleepFn(delay);
            continue;
        }
        throw new Error(await buildFailureMessage(response));
    }
    throw new Error("Stoat notification failed: no attempts made");
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
async function readRetryAfter(response, fallbackMs) {
    try {
        const body = (await response.json());
        const retryAfter = body.retry_after || fallbackMs;
        return retryAfter < 100 ? retryAfter * 1000 : retryAfter;
    }
    catch {
        return fallbackMs;
    }
}
async function buildFailureMessage(response) {
    const body = await response.text().catch(() => "");
    return `Stoat notification failed: ${response.status}${body ? ` ${body}` : ""}`;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
