# klikagent-github-trigger

GitHub webhook adapter for [KlikAgent](https://github.com/mihaamiharu/klikagent).

Translates GitHub issue and PR review events into normalized `QATask` payloads and forwards them to the KlikAgent orchestrator via HTTP.

## What it does

```
GitHub Webhook
    ↓
klikagent-github-trigger
    ├── Validates HMAC-SHA256 signature
    ├── issues labeled (status:ready-for-qa) → POST /tasks to KlikAgent
    └── pull_request_review (CHANGES_REQUESTED) → POST /reviews to KlikAgent
```

## Why a separate service

KlikAgent is provider-agnostic — it only knows about `QATask` payloads. This service handles all GitHub-specific concerns (webhook validation, payload parsing, label mapping) so KlikAgent can work with any ticket system (Jira, Linear, CLI) via its own trigger adapter.

## Setup

```bash
cp .env.example .env
# fill in the values
npm install
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `PORT` | Port to listen on (default: 3001) |
| `GITHUB_WEBHOOK_SECRET` | Secret used to validate GitHub HMAC signatures |
| `KLIKAGENT_URL` | Base URL of the KlikAgent instance (e.g. `http://localhost:3000`) |
| `GITHUB_TEST_REPO` | The QA output repo (e.g. `klikagent-tests`) |

## GitHub webhook configuration

Point your GitHub repo webhook to:
```
https://your-trigger-host.com/webhook/github
```

Events to subscribe:
- `Issues` (for `labeled` action)
- `Pull request reviews` (for `submitted` action)

## Scripts

```bash
npm run dev      # ts-node with auto-reload
npm run build    # compile to dist/
npm start        # run compiled output
npm test         # jest
```

## Relation to KlikAgent

This repo is part of the KlikAgent ecosystem:

| Repo | Role |
|---|---|
| `klikagent` | Core QA orchestrator — browser automation, spec generation, tsc validation, PR creation |
| `klikagent-github-trigger` | GitHub webhook adapter (this repo) |
| `klikagent-tests` | Generated Playwright test specs and POMs |
