import 'dotenv/config';
import express, { Request, Response } from 'express';
import { validateSignature } from './validator';
import { parseIssuePayload, parseReviewPayload } from './parser';
import { forwardTask, forwardReview } from './router';
import { GitHubIssuePayload, GitHubPRReviewPayload, GitHubReviewComment } from './types';

const app = express();

// Raw body required for HMAC signature validation
app.use(express.raw({ type: '*/*' }));

app.post('/webhook/github', async (req: Request, res: Response) => {
  const eventType = req.headers['x-github-event'] as string | undefined;
  console.log(`[trigger] POST /webhook/github event=${eventType ?? 'unknown'}`);

  if (!validateSignature(req)) {
    console.warn('[trigger] Invalid signature — rejecting');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse((req.body as Buffer).toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // Respond immediately — processing is async
  res.status(200).json({ received: true });

  try {
    if (eventType === 'issues') {
      const task = parseIssuePayload(payload as GitHubIssuePayload);
      if (!task) {
        console.log('[trigger] issues event ignored (not ready-for-qa or not labeled action)');
        return;
      }
      console.log(`[trigger] Forwarding task ${task.taskId} "${task.title}" to KlikAgent`);
      await forwardTask(task);
      console.log(`[trigger] Task ${task.taskId} forwarded`);
      return;
    }

    if (eventType === 'pull_request_review') {
      const reviewPayload = payload as GitHubPRReviewPayload;

      // Fetch inline review comments from GitHub API before forwarding
      const comments = await fetchReviewComments(
        reviewPayload.repository.full_name,
        reviewPayload.pull_request.number,
        reviewPayload.review.id,
      );

      const ctx = parseReviewPayload(reviewPayload, comments);
      if (!ctx) {
        console.log('[trigger] pull_request_review ignored (not CHANGES_REQUESTED)');
        return;
      }
      console.log(`[trigger] Forwarding review for PR #${ctx.prNumber} branch=${ctx.branch}`);
      await forwardReview(ctx);
      console.log(`[trigger] Review for PR #${ctx.prNumber} forwarded`);
      return;
    }

    console.log(`[trigger] Unhandled event type: ${eventType}`);
  } catch (err) {
    console.error(`[trigger] Error processing event: ${(err as Error).message}`);
  }
});

// ─── GitHub API helper ────────────────────────────────────────────────────────

async function fetchReviewComments(
  repoFullName: string,
  prNumber: number,
  reviewId: number,
): Promise<GitHubReviewComment[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[trigger] GITHUB_TOKEN not set — skipping inline comment fetch');
    return [];
  }

  const url = `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/comments`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    console.warn(`[trigger] Failed to fetch review comments: ${res.status}`);
    return [];
  }

  const all = await res.json() as Array<{
    id: number;
    pull_request_review_id: number;
    path: string;
    line: number | null;
    body: string;
    diff_hunk: string;
  }>;

  // Filter to only comments belonging to this review
  return all
    .filter((c) => c.pull_request_review_id === reviewId)
    .map((c) => ({
      id: c.id,
      path: c.path,
      line: c.line,
      body: c.body,
      diff_hunk: c.diff_hunk,
    }));
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
app.listen(port, () => {
  console.log(`[trigger] klikagent-github-trigger running on port ${port}`);
});
