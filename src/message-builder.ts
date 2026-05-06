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

export function buildPayload(config: ActionConfig, context: GitHubContext): StoatPayload {
  const event = resolveEvent(config.event, context);
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
        description: buildDescription(config, context, runUrl),
      },
    ],
  };
}

export function resolveEvent(event: EventType, context: GitHubContext): EventType {
  if (event !== "auto") {
    return event;
  }

  if (context.eventName === "release") {
    return "release_published";
  }

  if (context.eventName === "deployment_status") {
    return "deployment_success";
  }

  if (context.eventName === "pull_request") {
    return "pull_request";
  }

  if (context.eventName === "push") {
    return "push";
  }

  return "custom";
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

function buildDescription(config: ActionConfig, context: GitHubContext, runUrl: string): string {
  const lines = [`Event: ${context.eventName}`];

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
