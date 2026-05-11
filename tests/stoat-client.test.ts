import { describe, expect, it, vi } from "vitest";
import type { StoatPayload } from "../src/message-builder.js";
import { sendStoatWebhook, WebhookError } from "../src/stoat-client.js";

const payload: StoatPayload = {
  content: "CI failed",
  username: "GitHub",
  embeds: [
    {
      title: "CI failed",
      description: "Repository: systm-d/stoat-github-notify",
    },
  ],
};

describe("stoat client", () => {
  it("resolves { attempts: 1 } on 2xx success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
    });

    expect(result).toEqual({ attempts: 1 });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  });

  it("resolves { attempts: 2 } after a 429 followed by a 2xx", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 1 }), { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
      sleepFn,
    });

    expect(result).toEqual({ attempts: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(1000);
  });

  it("throws WebhookError with attempts=1 on non-429 failure", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));

    const promise = sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
    });

    await expect(promise).rejects.toBeInstanceOf(WebhookError);
    await expect(promise).rejects.toMatchObject({
      attempts: 1,
      message: "Stoat notification failed: 500 nope",
    });
  });

  it("throws WebhookError with attempts=2 after a 429 followed by a failure", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 1 }), { status: 429 }))
      .mockResolvedValueOnce(new Response("still nope", { status: 500 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const promise = sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
      sleepFn,
    });

    await expect(promise).rejects.toBeInstanceOf(WebhookError);
    await expect(promise).rejects.toMatchObject({
      attempts: 2,
      message: "Stoat notification failed: 500 still nope",
    });
  });
});
