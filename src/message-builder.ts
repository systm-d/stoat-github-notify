import type { ActionConfig, EventType } from "./config.js";
import type { GitHubContext } from "./github-context.js";
import { buildRunUrl } from "./github-context.js";

export interface StoatEmbed {
  title: string;
  description: string;
}

export interface StoatPayload {
  content: string;
  username: string;
  avatar?: string;
  embeds: StoatEmbed[];
}

export function buildPayload(config: ActionConfig, context: GitHubContext): StoatPayload | null {
  const event = resolveEvent(config.event, context);

  if (event === null) {
    return null;
  }

  const runUrl = buildRunUrl(context);
  const title = config.title || buildDefaultTitle(event, context);
  const content = config.message || buildDefaultContent(title, context, runUrl);

  return {
    content,
    username: config.username,
    avatar: config.avatarUrl,
    embeds: [
      {
        title,
        description: buildDescription(config, event, context, runUrl),
      },
    ],
  };
}

export function resolveEvent(event: EventType, context: GitHubContext): EventType | null {
  if (event !== "auto") {
    return event;
  }

  if (context.eventName === "release") {
    return "release_published";
  }

  if (context.eventName === "deployment_status") {
    const state = getString(context.payload, ["deployment_status", "state"]);

    return state === "failure" || state === "error" ? "deployment_failed" : "deployment_success";
  }

  if (context.eventName === "pull_request") {
    return "pull_request";
  }

  if (context.eventName === "push") {
    return "push";
  }

  return null;
}

export function buildDefaultTitle(event: EventType, context: GitHubContext): string {
  switch (event) {
    case "ci_failed":
      return "CI failed";
    case "ci_success":
      return "CI succeeded";
    case "release_published":
      return "Release published";
    case "deployment_success":
      return "Deployment succeeded";
    case "deployment_failed":
      return "Deployment failed";
    case "pull_request":
      return "Pull request updated";
    case "push":
      return "Push received";
    default:
      return `GitHub event: ${context.eventName}`;
  }
}

function buildDefaultContent(title: string, context: GitHubContext, runUrl: string): string {
  const suffix = runUrl ? `\n${runUrl}` : "";

  return `${title} on ${context.repository}${suffix}`;
}

function buildDescription(config: ActionConfig, event: EventType, context: GitHubContext, runUrl: string): string {
  const lines = buildEventLines(event, context);

  lines.push(`Event: ${context.eventName}`);

  if (context.workflow) {
    lines.push(`Workflow: ${context.workflow}`);
  }

  if (context.job) {
    lines.push(`Job: ${context.job}`);
  }

  if (config.includeRepository) {
    lines.push(`Repository: ${context.repository}`);
  }

  if (config.includeRef && context.ref) {
    lines.push(`Ref: ${context.ref}`);
  }

  if (config.includeActor) {
    lines.push(`Actor: ${context.actor}`);
  }

  if (context.sha) {
    lines.push(`Commit: ${context.sha.slice(0, 7)}`);
  }

  if (config.includeRunUrl && runUrl) {
    lines.push(`Run: ${runUrl}`);
  }

  return lines.join("\n");
}

function buildEventLines(event: EventType, context: GitHubContext): string[] {
  switch (event) {
    case "release_published":
      return compactLines([
        field("Release", getString(context.payload, ["release", "name"]) || getString(context.payload, ["release", "tag_name"])),
        field("Tag", getString(context.payload, ["release", "tag_name"])),
        field("URL", getString(context.payload, ["release", "html_url"])),
      ]);
    case "deployment_success":
    case "deployment_failed":
      return compactLines([
        field("Environment", getString(context.payload, ["deployment", "environment"])),
        field("State", getString(context.payload, ["deployment_status", "state"])),
        field("Deployment URL", getString(context.payload, ["deployment_status", "target_url"])),
      ]);
    case "pull_request":
      return compactLines([
        field("PR", formatPullRequest(context)),
        field("State", getString(context.payload, ["pull_request", "state"])),
        field("URL", getString(context.payload, ["pull_request", "html_url"])),
      ]);
    case "push":
      return compactLines([
        field("Pusher", getString(context.payload, ["pusher", "name"])),
        field("Compare", getString(context.payload, ["compare"])),
      ]);
    default:
      return [];
  }
}

function formatPullRequest(context: GitHubContext): string {
  const number = getNumber(context.payload, ["pull_request", "number"]);
  const title = getString(context.payload, ["pull_request", "title"]);

  if (number && title) {
    return `#${number} ${title}`;
  }

  return title || "";
}

function field(name: string, value?: string): string {
  return value ? `${name}: ${value}` : "";
}

function compactLines(lines: string[]): string[] {
  return lines.filter(Boolean);
}

function getString(payload: Record<string, unknown>, path: string[]): string {
  const value = getValue(payload, path);

  return typeof value === "string" ? value : "";
}

function getNumber(payload: Record<string, unknown>, path: string[]): number | undefined {
  const value = getValue(payload, path);

  return typeof value === "number" ? value : undefined;
}

function getValue(payload: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = payload;

  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
