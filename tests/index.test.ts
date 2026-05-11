import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionConfig } from "../src/config.js";
import type { GitHubContext } from "../src/github-context.js";
import type { StoatPayload } from "../src/message-builder.js";

vi.mock("../src/config.js", () => ({
  readConfig: vi.fn(),
  maskSecret: vi.fn(),
}));

vi.mock("../src/github-context.js", () => ({
  readGitHubContext: vi.fn(),
}));

vi.mock("../src/message-builder.js", () => ({
  buildPayload: vi.fn(),
}));

vi.mock("../src/stoat-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/stoat-client.js")>(
    "../src/stoat-client.js",
  );
  return {
    ...actual,
    sendStoatWebhook: vi.fn(),
  };
});

const { readConfig, maskSecret } = await import("../src/config.js");
const { readGitHubContext } = await import("../src/github-context.js");
const { buildPayload } = await import("../src/message-builder.js");
const { sendStoatWebhook, WebhookError } = await import("../src/stoat-client.js");
const { run, sanitizeError, setOutput } = await import("../src/index.js");

const webhookUrl = "https://example.test/webhook";

const baseConfig: ActionConfig = {
  webhookUrl,
  event: "ci_failed",
  username: "GitHub",
  includeActor: true,
  includeRepository: true,
  includeRef: true,
  includeRunUrl: true,
  failOnError: false,
  timeoutMs: 10000,
  dryRun: false,
};

const baseContext: GitHubContext = {
  eventName: "workflow_run",
  actor: "kevin",
  repository: "systm-d/stoat-github-notify",
  ref: "main",
  sha: "deadbeef",
  runId: "1",
  serverUrl: "https://github.com",
  workflow: "CI",
  job: "validate",
  payload: {},
};

const basePayload: StoatPayload = {
  content: "CI failed",
  username: "GitHub",
  embeds: [{ title: "CI failed", description: "" }],
};

let tmpDir: string;
let outputPath: string;

beforeEach(() => {
  vi.mocked(readConfig).mockReset();
  vi.mocked(maskSecret).mockReset();
  vi.mocked(readGitHubContext).mockReset();
  vi.mocked(buildPayload).mockReset();
  vi.mocked(sendStoatWebhook).mockReset();

  vi.mocked(readGitHubContext).mockReturnValue(baseContext);
  vi.mocked(buildPayload).mockReturnValue(basePayload);

  tmpDir = mkdtempSync(join(tmpdir(), "stoat-outputs-"));
  outputPath = join(tmpDir, "output");
  writeFileSync(outputPath, "");
  process.env.GITHUB_OUTPUT = outputPath;
  process.exitCode = undefined;
});

afterEach(() => {
  delete process.env.GITHUB_OUTPUT;
  rmSync(tmpDir, { recursive: true, force: true });
});

function readOutputs(): Record<string, string> {
  const content = readFileSync(outputPath, "utf8");
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    if (!line) {
      continue;
    }

    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }

    result[line.slice(0, index)] = line.slice(index + 1);
  }

  return result;
}

describe("run", () => {
  it("writes sent=true,status=sent,attempts=1 on first-try success", async () => {
    vi.mocked(readConfig).mockReturnValue(baseConfig);
    vi.mocked(sendStoatWebhook).mockResolvedValue({ attempts: 1 });

    await run();

    expect(readOutputs()).toEqual({
      sent: "true",
      status: "sent",
      error: "",
      attempts: "1",
    });
  });

  it("writes attempts=2 when the webhook succeeded after a retry", async () => {
    vi.mocked(readConfig).mockReturnValue(baseConfig);
    vi.mocked(sendStoatWebhook).mockResolvedValue({ attempts: 2 });

    await run();

    expect(readOutputs()).toMatchObject({
      sent: "true",
      status: "sent",
      attempts: "2",
    });
  });

  it("writes status=failed with attempts=1 on HTTP failure", async () => {
    vi.mocked(readConfig).mockReturnValue(baseConfig);
    vi.mocked(sendStoatWebhook).mockRejectedValue(
      new WebhookError("Stoat notification failed: 500 boom", 1),
    );

    await run();

    expect(readOutputs()).toMatchObject({
      sent: "false",
      status: "failed",
      attempts: "1",
      error: "Stoat notification failed: 500 boom",
    });
  });

  it("writes attempts=2 when the failure happens after a retry", async () => {
    vi.mocked(readConfig).mockReturnValue(baseConfig);
    vi.mocked(sendStoatWebhook).mockRejectedValue(
      new WebhookError("Stoat notification failed: 500 still", 2),
    );

    await run();

    expect(readOutputs()).toMatchObject({
      sent: "false",
      status: "failed",
      attempts: "2",
    });
  });

  it("writes attempts=0 on configuration errors raised before any HTTP call", async () => {
    vi.mocked(readConfig).mockImplementation(() => {
      throw new Error("Missing required input: webhook_url");
    });

    await run();

    expect(readOutputs()).toMatchObject({
      sent: "false",
      status: "failed",
      attempts: "0",
      error: "Missing required input: webhook_url",
    });
  });

  it("writes status=skipped when no auto-event template matches", async () => {
    vi.mocked(readConfig).mockReturnValue({ ...baseConfig, event: "auto" });
    vi.mocked(buildPayload).mockReturnValue(null);

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "skipped",
      error: "",
      attempts: "0",
    });
    expect(sendStoatWebhook).not.toHaveBeenCalled();
  });

  it("writes status=dry_run when dryRun is enabled and skips the HTTP call", async () => {
    vi.mocked(readConfig).mockReturnValue({ ...baseConfig, dryRun: true });

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "dry_run",
      error: "",
      attempts: "0",
    });
    expect(sendStoatWebhook).not.toHaveBeenCalled();
  });

  it("strips the webhook_url value from the error output", async () => {
    vi.mocked(readConfig).mockReturnValue(baseConfig);
    vi.mocked(sendStoatWebhook).mockRejectedValue(
      new WebhookError(`Stoat notification failed at ${webhookUrl}`, 1),
    );

    await run();

    const outputs = readOutputs();
    expect(outputs.error).not.toContain(webhookUrl);
    expect(outputs.error).toContain("[url]");
  });
});

describe("sanitizeError", () => {
  it("replaces the exact webhook URL with [url]", () => {
    expect(sanitizeError(`Failure at ${webhookUrl}/x`, webhookUrl)).not.toContain(webhookUrl);
  });

  it("also strips other URLs that leak through error bodies", () => {
    expect(sanitizeError("see https://logs.example/details for more", "")).toBe(
      "see [url] for more",
    );
  });
});

describe("setOutput", () => {
  it("is a no-op when GITHUB_OUTPUT is absent", () => {
    delete process.env.GITHUB_OUTPUT;
    expect(() => setOutput("status", "sent")).not.toThrow();
  });
});
