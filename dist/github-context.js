export function readGitHubContext(env = process.env) {
    return {
        eventName: env.GITHUB_EVENT_NAME || "workflow_run",
        actor: env.GITHUB_ACTOR || "unknown",
        repository: env.GITHUB_REPOSITORY || "unknown/unknown",
        ref: env.GITHUB_REF_NAME || env.GITHUB_REF || "",
        sha: env.GITHUB_SHA || "",
        runId: env.GITHUB_RUN_ID || "",
        serverUrl: env.GITHUB_SERVER_URL || "https://github.com",
    };
}
export function buildRunUrl(context) {
    if (!context.runId || context.repository === "unknown/unknown") {
        return "";
    }
    return `${context.serverUrl}/${context.repository}/actions/runs/${context.runId}`;
}
