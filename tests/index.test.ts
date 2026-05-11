import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  const actual = await vi.importActual<typeof import("../src/stoat-client.js")>("../src/stoat-client.js");

  return {
    sendStoatWebhook: vi.fn(),
    WebhookError: actual.WebhookError,
  };
});

import { maskSecret, readConfig } from "../src/config.js";
import { readGitHubContext } from "../src/github-context.js";
import { buildPayload } from "../src/message-builder.js";
import { sendStoatWebhook, WebhookError } from "../src/stoat-client.js";
import { run } from "../src/index.js";

const readConfigMock = vi.mocked(readConfig);
const maskSecretMock = vi.mocked(maskSecret);
const readGitHubContextMock = vi.mocked(readGitHubContext);
const buildPayloadMock = vi.mocked(buildPayload);
const sendStoatWebhookMock = vi.mocked(sendStoatWebhook);

const baseConfig: ActionConfig = {
  webhookUrl: "https://secret.example.test/hook/abc",
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
  sha: "abcdef1234567890",
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

let outputFile: string;

beforeEach(() => {
  vi.clearAllMocks();
  const dir = mkdtempSync(join(tmpdir(), "stoat-output-"));
  outputFile = join(dir, "output");
  writeFileSync(outputFile, "");
  process.env.GITHUB_OUTPUT = outputFile;
  process.exitCode = 0;

  readGitHubContextMock.mockReturnValue(baseContext);
  buildPayloadMock.mockReturnValue(basePayload);
});

afterEach(() => {
  delete process.env.GITHUB_OUTPUT;
});

function readOutputs(): Record<string, string> {
  const text = readFileSync(outputFile, "utf8");
  const result: Record<string, string> = {};

  for (const line of text.split("\n")) {
    if (!line) {
      continue;
    }
    const idx = line.indexOf("=");
    result[line.slice(0, idx)] = line.slice(idx + 1);
  }

  return result;
}

describe("run()", () => {
  it("writes sent=true status=sent attempts=1 on a successful send", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    sendStoatWebhookMock.mockResolvedValue({ attempts: 1 });

    await run();

    expect(readOutputs()).toEqual({
      sent: "true",
      status: "sent",
      error: "",
      attempts: "1",
    });
    expect(maskSecretMock).toHaveBeenCalledWith(baseConfig.webhookUrl);
  });

  it("writes attempts=2 after a 429 retry succeeds", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    sendStoatWebhookMock.mockResolvedValue({ attempts: 2 });

    await run();

    expect(readOutputs()).toEqual({
      sent: "true",
      status: "sent",
      error: "",
      attempts: "2",
    });
  });

  it("writes status=failed with attempts=1 on a non-429 HTTP failure", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    sendStoatWebhookMock.mockRejectedValue(new WebhookError("Stoat notification failed: 500 nope", 1));

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "failed",
      error: "Stoat notification failed: 500 nope",
      attempts: "1",
    });
  });

  it("writes status=failed with attempts=2 on failure after a 429 retry", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    sendStoatWebhookMock.mockRejectedValue(new WebhookError("Stoat notification failed: 500", 2));

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "failed",
      error: "Stoat notification failed: 500",
      attempts: "2",
    });
  });

  it("writes status=failed with attempts=0 on a configuration error", async () => {
    readConfigMock.mockImplementation(() => {
      throw new Error("Missing required input: webhook_url");
    });

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "failed",
      error: "Missing required input: webhook_url",
      attempts: "0",
    });
    expect(process.exitCode).toBe(1);
  });

  it("writes status=skipped when buildPayload returns null", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    buildPayloadMock.mockReturnValue(null);

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "skipped",
      error: "",
      attempts: "0",
    });
    expect(sendStoatWebhookMock).not.toHaveBeenCalled();
  });

  it("writes status=dry_run without calling the webhook when dryRun=true", async () => {
    readConfigMock.mockReturnValue({ ...baseConfig, dryRun: true });

    await run();

    expect(readOutputs()).toEqual({
      sent: "false",
      status: "dry_run",
      error: "",
      attempts: "0",
    });
    expect(sendStoatWebhookMock).not.toHaveBeenCalled();
    expect(buildPayloadMock).not.toHaveBeenCalled();
  });

  it("strips the webhook URL value from error output", async () => {
    readConfigMock.mockReturnValue(baseConfig);
    sendStoatWebhookMock.mockRejectedValue(
      new WebhookError(
        `Stoat notification failed: 500 leaked ${baseConfig.webhookUrl} and https://other.example/path?token=secret`,
        1,
      ),
    );

    await run();

    const outputs = readOutputs();
    expect(outputs.error).not.toContain(baseConfig.webhookUrl);
    expect(outputs.error).not.toContain("https://other.example");
    expect(outputs.error).toContain("[url]");
    expect(outputs.status).toBe("failed");
  });
});
