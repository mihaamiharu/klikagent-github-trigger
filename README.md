# klikagent-github-trigger

GitHub webhook adapter for [KlikAgent](https://github.com/mihaamiharu/klikagent).

Validates GitHub HMAC signatures and translates `issues` (labeled) and `pull_request_review` (CHANGES_REQUESTED) events into normalized payloads that KlikAgent understands. Also handles KlikAgent's result callbacks and comments on the originating GitHub issue.

Part of a three-repo system:

| Repo | Role |
|---|---|
| `klikagent` | Core QA orchestrator — agent pipeline, spec generation, self-correction |
| `klikagent-github-trigger` | GitHub webhook adapter (this repo) |
| `klikagent-demo-tests` | Generated test output, CI runner, GitHub Pages dashboard |

---

## Why a separate service

KlikAgent is trigger-agnostic — it only knows the `QATask` interface. This service handles all GitHub-specific concerns (HMAC validation, payload parsing, label transitions) so the core orchestrator can be reused with any ticket source (Jira, Linear, CLI) via a different adapter.

---

## Interaction Flow

```
GitHub Webhook (POST)
        │
        ▼
┌──────────────────────────────────────────┐
│  klikagent-github-trigger                │
│                                          │
│  1. Validate HMAC-SHA256 signature       │
│  2. Parse event type:                    │
│     issues.labeled → parseIssuePayload() │
│     pr_review.submitted → parseReview()  │
│  3. Map to QATask / ReviewContext        │
│  4. Save issue ref in memory store       │
│  5. Add callbackUrl to payload           │
│  6. Forward to KlikAgent                 │
└──────────────────────────────────────────┘
        │
        │  POST /tasks  or  POST /reviews
        ▼
    KlikAgent
        │
        │  POST /callback/tasks/:id/results  (async, on completion)
        ▼
┌──────────────────────────────────────────┐
│  klikagent-github-trigger (callback)     │
│                                          │
│  1. Look up issue ref by taskId          │
│  2. Comment on originating issue         │
│     (with summary + PR link)             │
│  3. Transition label:                    │
│     "klikagent" → "status:in-qa"         │
└──────────────────────────────────────────┘
```

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/github` | GitHub webhook receiver. Validates HMAC signature, dispatches on event type. |
| `POST` | `/tasks` | Manual task trigger (bypasses webhook). Accepts `QATask` directly. |
| `POST` | `/callback/tasks/:id/results` | KlikAgent posts `TaskResult` here when a run completes. Comments on issue, transitions label. |
| `GET` | `/health` | Health check. |

---

## Data Contracts

### QATask — sent to KlikAgent `POST /tasks`

```typescript
interface QATask {
  taskId: string;        // GitHub issue number, e.g. "42"
  title: string;
  description: string;   // Issue body (acceptance criteria)
  qaEnvUrl: string;      // e.g. "https://app.testingwithekki.com"
  outputRepo: string;    // e.g. "klikagent-demo-tests"
  feature?: string;      // Extracted from "feature:auth" label if present
  callbackUrl?: string;  // Set to this service's /callback/tasks/:id/results
  metadata?: Record<string, unknown>;
}
```

### ReviewContext — sent to KlikAgent `POST /reviews`

```typescript
interface ReviewContext {
  prNumber: number;
  repo: string;
  outputRepo: string;
  branch: string;
  ticketId: string;        // Extracted from branch name, e.g. qa/42-login → "42"
  reviewId: number;
  reviewerLogin: string;
  comments: ReviewComment[];  // Inline code review comments from GitHub
  specPath: string;           // First .spec.ts file changed in the PR
}
```

### TaskResult — received from KlikAgent at `/callback/tasks/:id/results`

```typescript
interface TaskResult {
  taskId: string;
  passed: boolean;
  summary: string;
  reportUrl?: string;    // Link to the opened draft PR
  metadata?: Record<string, unknown>;
}
```

---

## GitHub Events Handled

### `issues` — `labeled`

Fires when a label is added to an issue.

**Trigger condition:** Label name is exactly `klikagent`

**Action:**
1. `parseIssuePayload()` extracts issue number, title, body
2. Looks for a `feature:*` label (e.g. `feature:auth`) to set `feature` field
3. Returns `QATask` or `null` (null = ignore)
4. Issue ref saved to store → `{ owner, repo, issueNumber }` keyed by `taskId`
5. Forwarded to KlikAgent with `callbackUrl` injected

### `pull_request_review` — `submitted`

Fires when a PR review is submitted.

**Trigger condition:** Review state is `CHANGES_REQUESTED` and reviewer is not a bot

**Action:**
1. `parseReviewPayload()` extracts PR number, branch, reviewer, inline comments
2. Filters out comments that are only bot replies
3. Extracts `ticketId` from branch name (e.g. `qa/42-login` → `"42"`)
4. Fetches the first changed `.spec.ts` file path via GitHub API
5. Returns `ReviewContext`
6. Forwarded to KlikAgent `POST /reviews`

---

## Setup

```bash
cp .env.example .env
# fill in values
npm install
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port to listen on (default: 3001) |
| `GITHUB_WEBHOOK_SECRET` | Secret used to validate GitHub HMAC-SHA256 signatures |
| `KLIKAGENT_URL` | Base URL of the KlikAgent instance (e.g. `http://localhost:3000`) |
| `GITHUB_TEST_REPO` | Default QA output repo name (e.g. `klikagent-demo-tests`) |
| `QA_ENV_URL` | Default QA environment URL forwarded in QATask |
| `GITHUB_TOKEN` | Personal access token (needed for GitHub API calls in `github.ts`) |

### GitHub Webhook Configuration

Point your GitHub repo webhook to:
```
https://your-trigger-host.com/webhook/github
```

Subscribe to these events:
- **Issues** (`labeled` action)
- **Pull request reviews** (`submitted` action)

Set **Content type** to `application/json` and use the same value as `GITHUB_WEBHOOK_SECRET`.

---

## Source Map

```
src/
├── server.ts        # Express entry point (4 routes)
├── validator.ts     # HMAC-SHA256 signature validation
├── parser.ts        # GitHub payload → QATask / ReviewContext
├── router.ts        # HTTP forwarding to KlikAgent endpoints
├── github.ts        # GitHub API helpers (comment on issue, transition label, fetch PR files)
├── store.ts         # In-memory Map<taskId, IssueRef> for callback correlation
└── types.ts         # All TypeScript interfaces
```

---

## Scripts

```bash
npm run dev    # ts-node + nodemon (auto-reload)
npm run build  # tsc → dist/
npm start      # node dist/server.js
npm test       # jest
```

---

## Testing Locally

```bash
# Manual task trigger (no HMAC needed)
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "42",
    "title": "Test login flow",
    "description": "User can log in with valid credentials",
    "qaEnvUrl": "https://app.testingwithekki.com",
    "outputRepo": "klikagent-demo-tests",
    "feature": "auth"
  }'

# Simulate KlikAgent callback
curl -X POST http://localhost:3001/callback/tasks/42/results \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "42",
    "passed": true,
    "summary": "Generated auth spec with AuthPage POM",
    "reportUrl": "https://github.com/org/klikagent-demo-tests/pull/7"
  }'
```
