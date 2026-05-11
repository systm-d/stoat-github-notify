import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { maskSecret, readConfig } from "./config.js";
import { readGitHubContext } from "./github-context.js";
import { buildPayload } from "./message-builder.js";
import { sendStoatWebhook, WebhookError } from "./stoat-client.js";
export async function run() {
    let failOnError = false;
    let webhookUrl = "";
    try {
        const config = readConfig();
        failOnError = config.failOnError;
        webhookUrl = config.webhookUrl;
        maskSecret(config.webhookUrl);
        if (config.dryRun) {
            writeOutputs({ sent: false, status: "dry_run", error: "", attempts: 0 });
            info("Stoat notification skipped (dry_run).");
            return;
        }
        const context = readGitHubContext();
        const payload = buildPayload(config, context);
        if (payload === null) {
            writeOutputs({ sent: false, status: "skipped", error: "", attempts: 0 });
            info(`Stoat notification skipped: no template for event ${context.eventName}.`);
            return;
        }
        const { attempts } = await sendStoatWebhook(payload, config.webhookUrl, {
            timeoutMs: config.timeoutMs,
        });
        writeOutputs({ sent: true, status: "sent", error: "", attempts });
        info("Stoat notification sent.");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = error instanceof WebhookError ? error.attempts : 0;
        const sanitized = sanitizeError(message, webhookUrl);
        writeOutputs({ sent: false, status: "failed", error: sanitized, attempts });
        if (failOnError || isConfigurationError(message)) {
            setFailed(sanitized);
        }
        else {
            warning(sanitized);
        }
    }
}
export function setOutput(name, value) {
    const file = process.env.GITHUB_OUTPUT;
    if (!file) {
        return;
    }
    appendFileSync(file, `${name}=${value}\n`);
}
export function sanitizeError(message, webhookUrl) {
    let result = message;
    if (webhookUrl) {
        result = result.split(webhookUrl).join("[url]");
    }
    return result.replace(/https?:\/\/\S+/g, "[url]");
}
function writeOutputs(outputs) {
    setOutput("sent", outputs.sent ? "true" : "false");
    setOutput("status", outputs.status);
    setOutput("error", outputs.error);
    setOutput("attempts", String(outputs.attempts));
}
function isConfigurationError(message) {
    return (message.startsWith("Missing required input") ||
        message.startsWith("Invalid ") ||
        message.startsWith("Unsupported event type"));
}
function info(message) {
    console.log(message);
}
function warning(message) {
    console.log(`::warning::${message}`);
}
function setFailed(message) {
    console.log(`::error::${message}`);
    process.exitCode = 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    void run();
}
