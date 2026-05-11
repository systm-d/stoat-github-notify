import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { maskSecret, readConfig } from "./config.js";
import { readGitHubContext } from "./github-context.js";
import { buildPayload, resolveEvent } from "./message-builder.js";
import { sendStoatWebhook } from "./stoat-client.js";

export interface RunOptions {
  fetchFn?: typeof fetch;
}

export async function run(options: RunOptions = {}): Promise<void> {
  let failOnError = false;

  try {
    const config = readConfig();
    failOnError = config.failOnError;
    maskSecret(config.webhookUrl);

    const context = readGitHubContext();
    const payload = buildPayload(config, context);

    if (config.dryRun) {
      const event = resolveEvent(config.event, context);
      info("[dry-run] Webhook call skipped — no request sent");
      info(`[dry-run] Resolved event: ${event}`);
      info(`[dry-run] Payload: ${JSON.stringify(payload)}`);
      setOutput("notification_sent", "false");
      return;
    }

    await sendStoatWebhook(payload, config.webhookUrl, {
      timeoutMs: config.timeoutMs,
      fetchFn: options.fetchFn,
    });

    setOutput("notification_sent", "true");
    info("Stoat notification sent.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (failOnError || isConfigurationError(message)) {
      setFailed(message);
    } else {
      warning(message);
    }
  }
}

function isConfigurationError(message: string): boolean {
  return (
    message.startsWith("Missing required input") ||
    message.startsWith("Invalid ") ||
    message.startsWith("Unsupported event type")
  );
}

function info(message: string): void {
  console.log(message);
}

function warning(message: string): void {
  console.log(`::warning::${message}`);
}

function setFailed(message: string): void {
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value}\n`);
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void run();
}
