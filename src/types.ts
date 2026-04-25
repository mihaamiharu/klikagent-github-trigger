// ─── GitHub webhook payloads ──────────────────────────────────────────────────

export interface GitHubIssuePayload {
  action: string;
  label?: { name: string };
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels: Array<{ name: string }>;
  };
  repository: {
    name: string;
    full_name: string;
  };
}

export interface GitHubReviewComment {
  id: number;
  path: string;
  line: number | null;
  body: string;
  diff_hunk: string;
}

export interface GitHubPRReviewPayload {
  action: string;
  review: {
    id: number;
    state: string;
    user: { login: string };
    body: string | null;
  };
  pull_request: {
    number: number;
    draft: boolean;
    head: { ref: string };
  };
  repository: {
    name: string;
    full_name: string;
  };
}

// ─── KlikAgent contract types ─────────────────────────────────────────────────

// Normalized task payload sent to POST /tasks on KlikAgent
export interface QATask {
  taskId: string;
  title: string;
  description: string;
  qaEnvUrl: string;
  outputRepo: string;
  feature?: string;                // feature area e.g. "auth" — from feature:* label
  callbackUrl?: string;            // KlikAgent POSTs TaskResult here when done
  metadata?: Record<string, unknown>;
}

// Result payload KlikAgent POSTs to callbackUrl when spec generation is done
export interface TaskResult {
  taskId: string;
  passed: boolean;
  summary: string;
  reportUrl?: string;
  metadata?: Record<string, unknown>;
}

// Review comment forwarded to KlikAgent
export interface ReviewComment {
  id: number;
  path: string;
  line: number | null;
  body: string;
  diffHunk: string;
}

// Review context sent to POST /reviews on KlikAgent
export interface ReviewContext {
  prNumber: number;
  repo: string;
  outputRepo: string;   // klikagent requires this — same value as repo
  branch: string;
  ticketId: string;     // klikagent field name (was taskId)
  reviewId: number;
  reviewerLogin: string;
  comments: ReviewComment[];
}
