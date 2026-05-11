import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/index.js";

const inputKeys = [
  "INPUT_WEBHOOK_URL",
  "INPUT_EVENT",
  "INPUT_DRY_RUN",
  "INPUT_FAIL_ON_ERROR",
  "GITHUB_OUTPUT",
];

describe("run", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of inputKeys) {
      delete process.env[key];
    }
    process.env.INPUT_WEBHOOK_URL = "https://example.test/webhook";
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    logSpy.mockRestore();
    for (const key of inputKeys) {
      delete process.env[key];
    }
    process.exitCode = undefined;
  });

  it("does not call fetchFn in dry-run mode and logs the dry-run banner", async () => {
    process.env.INPUT_DRY_RUN = "true";
    const fetchFn = vi.fn();

    await expect(run({ fetchFn: fetchFn as unknown as typeof fetch })).resolves.toBeUndefined();

    expect(fetchFn).not.toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("[dry-run] Webhook call skipped — no request sent");
    expect(logged).toContain("[dry-run] Payload:");
    expect(process.exitCode).not.toBe(1);
  });

  it("calls fetchFn once in normal mode and does not log dry-run banner", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await run({ fetchFn: fetchFn as unknown as typeof fetch });

    expect(fetchFn).toHaveBeenCalledOnce();
    const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain("[dry-run]");
  });
});
