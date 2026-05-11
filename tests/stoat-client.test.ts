import { describe, expect, it, vi } from "vitest";
import type { StoatPayload } from "../src/message-builder.js";
import { sendStoatWebhook } from "../src/stoat-client.js";

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
  it("posts the webhook payload", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const attempts = await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      retryCount: 1,
      retryDelayMs: 1000,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(attempts).toBe(1);
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  });

  it("retries once after a 429 response", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 1 }), { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const attempts = await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      retryCount: 1,
      retryDelayMs: 1000,
      fetchFn,
      sleepFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(1000);
    expect(attempts).toBe(2);
  });

  it("uses retryDelayMs when the 429 response has no retry_after", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      retryCount: 1,
      retryDelayMs: 2500,
      fetchFn,
      sleepFn,
    });

    expect(sleepFn).toHaveBeenCalledWith(2500);
  });

  it("rejects after exhausting retries on repeated 429 responses", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 1 }), { status: 429 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendStoatWebhook(payload, "https://example.test/webhook", {
        timeoutMs: 10000,
        retryCount: 1,
        retryDelayMs: 1000,
        fetchFn,
        sleepFn,
      }),
    ).rejects.toThrow("Stoat notification failed: 429 rate limited");

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledOnce();
  });

  it("rejects immediately on 429 when retries are disabled", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendStoatWebhook(payload, "https://example.test/webhook", {
        timeoutMs: 10000,
        retryCount: 0,
        retryDelayMs: 1000,
        fetchFn,
        sleepFn,
      }),
    ).rejects.toThrow("Stoat notification failed: 429 slow down");

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("throws on non-success responses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(
      sendStoatWebhook(payload, "https://example.test/webhook", {
        timeoutMs: 10000,
        retryCount: 1,
        retryDelayMs: 1000,
        fetchFn,
      }),
    ).rejects.toThrow("Stoat notification failed: 500 nope");
  });
});
