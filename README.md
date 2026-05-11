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

Notify on a published release:

```yaml
on:
  release:
    types: [published]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: systm-d/stoat-github-notify@v0.1.0
        with:
          webhook_url: ${{ secrets.STOAT_WEBHOOK_URL }}
          event: release_published
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
| `dry_run` | no | `false` | Skip the HTTP request and report `status=dry_run` instead of sending. |

## Outputs

| Nom | Valeurs possibles | Description |
| --- | --- | --- |
| `sent` | `true` / `false` | `true` si le webhook a été envoyé avec succès, sinon `false`. |
| `status` | `sent` / `failed` / `skipped` / `dry_run` | Statut final de la notification. |
| `error` | chaîne courte / vide | Message d'erreur court (chaîne vide en cas de succès). La valeur de `webhook_url` est expurgée avant publication. |
| `attempts` | entier ≥ 0 | Nombre de tentatives HTTP effectuées (`0` si erreur de configuration, `dry_run` ou résolution sans correspondance ; `1` ou `2` selon que le retry 429 a été déclenché). |

Example consumer workflow:

```yaml
- name: Notify Stoat
  id: notify
  uses: systm-d/stoat-github-notify@v1
  with:
    webhook_url: ${{ secrets.STOAT_WEBHOOK_URL }}
    event: ci_failed

- name: Record delivery failure
  if: steps.notify.outputs.status == 'failed'
  run: echo "Stoat notification failed after ${{ steps.notify.outputs.attempts }} attempt(s): ${{ steps.notify.outputs.error }}"
```

## Event types

Use `event: auto` to infer the template from `GITHUB_EVENT_NAME` when possible. For CI success or failure notifications, set the event explicitly from a conditional step:

- `ci_success`: successful workflow or job.
- `ci_failed`: failed workflow or job.
- `release_published`: published release, with release name, tag, and URL when available.
- `deployment_success`: deployment status notification.
- `deployment_failed`: failed deployment status notification.
- `pull_request`: pull request update, with PR number, title, state, and URL when available.
- `push`: push notification, with pusher and compare URL when available.
- `custom`: custom title and message.

## Release process

Create immutable version tags for consumers:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Consumers should pin a version:

```yaml
uses: systm-d/stoat-github-notify@v0.1.0
```

Move the `v1` tag only after the action is stable enough for broad reuse.

## Troubleshooting

- No message in Stoat: confirm the workflow has a step using this action. A normal CI workflow does not notify unless the action is called.
- Missing secret: add `STOAT_WEBHOOK_URL` under repository or organization Actions secrets.
- Hidden delivery failures: set `fail_on_error: true` while testing.
- Bad payload or rate limit: inspect the GitHub Actions logs. The webhook URL is masked.

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
