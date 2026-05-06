import { readFileSync } from "node:fs";

export interface GitHubContext {
  eventName: string;
  actor: string;
  repository: string;
  ref: string;
  sha: string;
  runId: string;
  serverUrl: string;
  workflow: string;
  job: string;
  payload: Record<string, unknown>;
}

export function readGitHubContext(env: NodeJS.ProcessEnv = process.env): GitHubContext {
  return {
    eventName: env.GITHUB_EVENT_NAME || "workflow_run",
    actor: env.GITHUB_ACTOR || "unknown",
    repository: env.GITHUB_REPOSITORY || "unknown/unknown",
    ref: env.GITHUB_REF_NAME || env.GITHUB_REF || "",
    sha: env.GITHUB_SHA || "",
    runId: env.GITHUB_RUN_ID || "",
    serverUrl: env.GITHUB_SERVER_URL || "https://github.com",
    workflow: env.GITHUB_WORKFLOW || "",
    job: env.GITHUB_JOB || "",
    payload: readEventPayload(env.GITHUB_EVENT_PATH),
  };
}

export function buildRunUrl(context: GitHubContext): string {
  if (!context.runId || context.repository === "unknown/unknown") {
    return "";
  }

  return `${context.serverUrl}/${context.repository}/actions/runs/${context.runId}`;
}

function readEventPayload(path?: string): Record<string, unknown> {
  if (!path) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}
