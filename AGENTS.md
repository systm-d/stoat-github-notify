# Repository Guidelines

## Project Structure & Module Organization

`stoat-github-notify` is a Node.js 20 GitHub Action that posts workflow and repository events to Stoat webhooks.

- `action.yml` defines the action metadata, inputs, runtime, and Marketplace branding.
- `src/` contains the TypeScript source. Keep config parsing, GitHub context, message construction, and Stoat transport concerns separated.
- `dist/` contains the committed JavaScript runtime used by GitHub Actions.
- `tests/` contains Vitest unit tests.
- `.github/workflows/ci.yml` validates type checks, tests, and builds.

## Build, Test, and Development Commands

Use pnpm for local development:

- `pnpm install`: install dependencies.
- `pnpm typecheck`: run TypeScript without emitting files.
- `pnpm test`: run the Vitest suite.
- `pnpm build`: compile `src/` into `dist/`.

Run `pnpm build` before releasing because `action.yml` executes `dist/index.js`.

## Coding Style & Naming Conventions

Use TypeScript with ES modules and strict type checking. Prefer small modules with explicit interfaces for action inputs, GitHub context, Stoat payloads, and transport options. Use 2-space indentation for JSON and YAML, and keep Markdown headings concise.

Use kebab-case for workflow and documentation filenames, camelCase for variables and functions, and PascalCase for TypeScript interfaces and type aliases that model objects.

## Testing Guidelines

Tests use Vitest and live in `tests/*.test.ts`. Add focused tests for each behavior change, especially input parsing, event resolution, message rendering, HTTP failures, rate-limit retry behavior, and `fail_on_error` handling.

Prefer behavior-focused test names such as `retries once after a 429 response`.

## Commit & Pull Request Guidelines

The history only establishes `Initial commit`, so use short imperative commit messages such as `Add Stoat webhook client` or `Document action inputs`.

Pull requests should include a concise description, motivation, testing performed, and any required secret or workflow configuration changes. Link issues when available. Include logs only when they clarify behavior.

## Security & Configuration Tips

Never commit webhook URLs, bot tokens, or real Stoat credentials. Keep `webhook_url` in GitHub Secrets and ensure it remains masked with `::add-mask::`. Do not log request bodies when they may contain user-provided content or sensitive URLs.
