const eventTypes = new Set([
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
export function readConfig(env = process.env) {
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
        dryRun: readBooleanInput(env, "dry_run", false),
    };
}
export function maskSecret(value) {
    if (value) {
        console.log(`::add-mask::${value}`);
    }
}
function readInput(env, name, required = false) {
    const value = env[`INPUT_${name.toUpperCase()}`]?.trim() || "";
    if (required && !value) {
        throw new Error(`Missing required input: ${name}`);
    }
    return value;
}
function readBooleanInput(env, name, defaultValue) {
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
function readEvent(value) {
    if (eventTypes.has(value)) {
        return value;
    }
    throw new Error(`Unsupported event type: ${value}`);
}
function readPositiveInteger(value, name) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid positive integer input for ${name}: ${value}`);
    }
    return parsed;
}
