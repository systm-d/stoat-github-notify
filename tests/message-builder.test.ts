import { describe, expect, it } from "vitest";
import type { ActionConfig } from "../src/config.js";
import type { GitHubContext } from "../src/github-context.js";
import { buildPayload, resolveEvent } from "../src/message-builder.js";

const baseConfig: ActionConfig = {
  webhookUrl: "https://example.test/webhook",
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
  sha: "1234567890abcdef",
  runId: "42",
  serverUrl: "https://github.com",
  workflow: "CI",
  job: "validate",
  payload: {},
};

describe("message builder", () => {
  it("builds a default CI failure payload", () => {
    const payload = buildPayload(baseConfig, baseContext);

    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({
      content: "CI failed on systm-d/stoat-github-notify\nhttps://github.com/systm-d/stoat-github-notify/actions/runs/42",
      username: "GitHub",
      embeds: [
        {
          title: "CI failed",
        },
      ],
    });
    expect(payload?.embeds[0]?.description).toContain("Actor: kevin");
    expect(payload?.embeds[0]?.description).toContain("Commit: 1234567");
  });

  it("uses custom title and message when provided", () => {
    const payload = buildPayload(
      {
        ...baseConfig,
        event: "custom",
        title: "Build finished",
        message: "Docker image is available.",
      },
      baseContext,
    );

    expect(payload?.content).toBe("Docker image is available.");
    expect(payload?.embeds[0]?.title).toBe("Build finished");
  });

  it("returns null when auto event has no mapping", () => {
    expect(resolveEvent("auto", { ...baseContext, eventName: "schedule" })).toBeNull();
    expect(buildPayload({ ...baseConfig, event: "auto" }, { ...baseContext, eventName: "schedule" })).toBeNull();
  });

  it("resolves automatic event names", () => {
    expect(resolveEvent("auto", { ...baseContext, eventName: "release" })).toBe("release_published");
    expect(resolveEvent("auto", { ...baseContext, eventName: "pull_request" })).toBe("pull_request");
    expect(resolveEvent("auto", { ...baseContext, eventName: "push" })).toBe("push");
    expect(
      resolveEvent("auto", {
        ...baseContext,
        eventName: "deployment_status",
        payload: {
          deployment_status: {
            state: "failure",
          },
        },
      }),
    ).toBe("deployment_failed");
    expect(
      resolveEvent("auto", {
        ...baseContext,
        eventName: "deployment_status",
        payload: {
          deployment_status: {
            state: "error",
          },
        },
      }),
    ).toBe("deployment_failed");
  });

  it("renders release details from the GitHub event payload", () => {
    const payload = buildPayload(
      {
        ...baseConfig,
        event: "release_published",
      },
      {
        ...baseContext,
        eventName: "release",
        payload: {
          release: {
            name: "Version 0.1.0",
            tag_name: "v0.1.0",
            html_url: "https://github.com/systm-d/stoat-github-notify/releases/tag/v0.1.0",
          },
        },
      },
    );

    expect(payload.embeds[0]?.description).toContain("Release: Version 0.1.0");
    expect(payload.embeds[0]?.description).toContain("Tag: v0.1.0");
  });

  it("renders pull request details from the GitHub event payload", () => {
    const payload = buildPayload(
      {
        ...baseConfig,
        event: "pull_request",
      },
      {
        ...baseContext,
        eventName: "pull_request",
        payload: {
          pull_request: {
            number: 12,
            title: "Add Stoat templates",
            state: "open",
            html_url: "https://github.com/systm-d/stoat-github-notify/pull/12",
          },
        },
      },
    );

    expect(payload.embeds[0]?.description).toContain("PR: #12 Add Stoat templates");
    expect(payload.embeds[0]?.description).toContain("State: open");
  });
});
