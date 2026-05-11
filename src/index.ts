import { maskSecret, readConfig } from "./config.js";
import { readGitHubContext } from "./github-context.js";
import { buildPayload } from "./message-builder.js";
import { sendStoatWebhook } from "./stoat-client.js";

export async function run(): Promise<void> {
  let failOnError = false;

  try {
    const config = readConfig();
    failOnError = config.failOnError;
    maskSecret(config.webhookUrl);

    const context = readGitHubContext();
    const payload = buildPayload(config, context);

    await sendStoatWebhook(payload, config.webhookUrl, {
      timeoutMs: config.timeoutMs,
      retryCount: config.retryCount,
      retryDelayMs: config.retryDelayMs,
    });

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

void run();
