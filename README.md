# Stoat GitHub Notify

A lightweight GitHub Action to publish CI, release, deployment, pull request, push, and custom events to Stoat channels.

## What is it?

`stoat-github-notify` sends a single readable notification from a GitHub workflow to a Stoat webhook URL. It is designed as a simple CI/CD notifier, not a long-running bot.

## Quick start

```yaml
- name: Notify Stoat
  if: failure()
  uses: systm-d/stoat-github-notify@v1
  with:
    webhook_url: ${{ secrets.STOAT_WEBHOOK_URL }}
    event: ci_failed
```

Store the webhook URL in GitHub Secrets. The action masks it in logs before sending the request.

## Usage examples

Notify on CI failure:

```yaml
- name: Notify Stoat on failure
  if: failure()
  uses: systm-d/stoat-github-notify@v1
  with:
    webhook_url: ${{ secrets.STOAT_WEBHOOK_URL }}
    event: ci_failed
    title: "CI failed"
    fail_on_error: false
```

Send a custom message:

```yaml
- uses: systm-d/stoat-github-notify@v1
  with:
    webhook_url: ${{ secrets.STOAT_WEBHOOK_URL }}
    event: custom
    title: "Build finished"
    message: "The Docker image is available."
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `webhook_url` | yes | | Stoat webhook URL. Use a GitHub Secret. |
| `event` | no | `auto` | `auto`, `ci_success`, `ci_failed`, `release_published`, `deployment_success`, `deployment_failed`, `pull_request`, `push`, or `custom`. |
| `title` | no | generated | Custom notification title. |
| `message` | no | generated | Custom notification content. |
| `username` | no | `GitHub` | Webhook display name. |
| `avatar_url` | no | | Webhook avatar URL. |
| `include_actor` | no | `true` | Include the GitHub actor in the embed. |
| `include_repository` | no | `true` | Include the repository name. |
| `include_ref` | no | `true` | Include the branch or tag ref. |
| `include_run_url` | no | `true` | Include the GitHub Actions run URL. |
| `fail_on_error` | no | `false` | Fail the workflow if the Stoat request fails. |
| `timeout_ms` | no | `10000` | HTTP timeout in milliseconds. |

## Development

This action uses Node.js 20, TypeScript, pnpm, and Vitest.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`dist/` is committed because GitHub Actions executes `dist/index.js` directly.

## Security

Never commit webhook URLs, bot tokens, or real Stoat credentials. Keep `fail_on_error` disabled unless notification delivery must block the workflow. The action sends one message per run and retries once after a `429` rate-limit response.
