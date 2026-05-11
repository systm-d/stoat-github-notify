import { appendFileSync } from "node:fs";
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
            info(`Stoat notification skipped: no template matches event '${context.eventName}'.`);
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
function writeOutputs(record) {
    setOutput("sent", record.sent ? "true" : "false");
    setOutput("status", record.status);
    setOutput("error", record.error);
    setOutput("attempts", String(record.attempts));
}
export function setOutput(name, value) {
    const path = process.env.GITHUB_OUTPUT;
    if (!path) {
        return;
    }
    appendFileSync(path, `${name}=${value}\n`);
}
export function sanitizeError(message, webhookUrl) {
    let sanitized = message;
    if (webhookUrl) {
        sanitized = sanitized.split(webhookUrl).join("[url]");
    }
    return sanitized.replace(/https?:\/\/\S+/g, "[url]");
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
if (!process.env.VITEST) {
    void run();
}
