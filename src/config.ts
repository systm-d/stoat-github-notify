export type EventType =
  | "auto"
  | "ci_success"
  | "ci_failed"
  | "release_published"
  | "deployment_success"
  | "deployment_failed"
  | "pull_request"
  | "push"
  | "custom";

export interface ActionConfig {
  webhookUrl: string;
  event: EventType;
  title?: string;
  message?: string;
  username: string;
  avatarUrl?: string;
  includeActor: boolean;
  includeRepository: boolean;
  includeRef: boolean;
  includeRunUrl: boolean;
  failOnError: boolean;
  timeoutMs: number;
}

const eventTypes = new Set<EventType>([
  "auto",
  "ci_success",
  "ci_failed",
  "release_published",
  "deployment_success",
  "deployment_failed",
  "pull_request",
  "push",
  "custom",
]);

export function readConfig(env: NodeJS.ProcessEnv = process.env): ActionConfig {
  const webhookUrl = readInput(env, "webhook_url", true);
  const event = readEvent(readInput(env, "event") || "auto");

  return {
    webhookUrl,
    event,
    title: readInput(env, "title") || undefined,
    message: readInput(env, "message") || undefined,
    username: readInput(env, "username") || "GitHub",
    avatarUrl: readInput(env, "avatar_url") || undefined,
    includeActor: readBooleanInput(env, "include_actor", true),
    includeRepository: readBooleanInput(env, "include_repository", true),
    includeRef: readBooleanInput(env, "include_ref", true),
    includeRunUrl: readBooleanInput(env, "include_run_url", true),
    failOnError: readBooleanInput(env, "fail_on_error", false),
    timeoutMs: readPositiveInteger(readInput(env, "timeout_ms") || "10000", "timeout_ms"),
  };
}

export function maskSecret(value: string): void {
  if (value) {
    console.log(`::add-mask::${value}`);
  }
}

function readInput(env: NodeJS.ProcessEnv, name: string, required = false): string {
  const value = env[`INPUT_${name.toUpperCase()}`]?.trim() || "";

  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function readBooleanInput(env: NodeJS.ProcessEnv, name: string, defaultValue: boolean): boolean {
  const value = readInput(env, name);

  if (!value) {
    return defaultValue;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  throw new Error(`Invalid boolean input for ${name}: ${value}`);
}

function readEvent(value: string): EventType {
  if (eventTypes.has(value as EventType)) {
    return value as EventType;
  }

  throw new Error(`Unsupported event type: ${value}`);
}

function readPositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer input for ${name}: ${value}`);
  }

  return parsed;
}
