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

    await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledOnce();
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

    await sendStoatWebhook(payload, "https://example.test/webhook", {
      timeoutMs: 10000,
      fetchFn,
      sleepFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(1000);
  });

  it("throws on non-success responses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(
      sendStoatWebhook(payload, "https://example.test/webhook", {
        timeoutMs: 10000,
        fetchFn,
      }),
    ).rejects.toThrow("Stoat notification failed: 500 nope");
  });
});
