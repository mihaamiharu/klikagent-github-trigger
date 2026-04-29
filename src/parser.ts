import {
  GitHubIssuePayload,
  GitHubPRReviewPayload,
  GitHubReviewComment,
  QATask,
  ReviewComment,
  ReviewContext,
} from './types';

const KLIKAGENT_LABEL = 'klikagent';

/**
 * Parses a GitHub `issues` webhook payload.
 * Returns a QATask if the event should trigger QA spec generation,
 * or null if it should be ignored.
 */
export function parseIssuePayload(payload: GitHubIssuePayload): QATask | null {
  if (payload.action !== 'labeled') return null;
  if (payload.label?.name !== KLIKAGENT_LABEL) return null;

  const qaEnvUrl = process.env.QA_ENV_URL ?? '';
  const outputRepo = process.env.GITHUB_TEST_REPO ?? 'klikagent-tests';

  // Extract feature label if present (e.g. "feature:auth" → "auth")
  const featureLabel = payload.issue.labels
    .map((l) => l.name)
    .find((n) => n.startsWith('feature:'));
  const feature = featureLabel ? featureLabel.replace('feature:', '') : undefined;

  return {
    taskId: String(payload.issue.number),
    title: payload.issue.title,
    description: payload.issue.body ?? '',
    qaEnvUrl,
    outputRepo,
    ...(feature ? { feature } : {}),
    metadata: {
      issueUrl: payload.issue.html_url,
      repoFullName: payload.repository.full_name,
      labels: payload.issue.labels.map((l) => l.name),
    },
  };
}

/**
 * Parses a GitHub `pull_request_review` webhook payload.
 * Returns a ReviewContext if the review is CHANGES_REQUESTED,
 * or null if it should be ignored.
 */
export function parseReviewPayload(
  payload: GitHubPRReviewPayload,
  inlineComments: GitHubReviewComment[],
  specPath: string,
): ReviewContext | null {
  if (payload.action !== 'submitted') return null;

  const state = payload.review.state.toUpperCase();
  if (state !== 'CHANGES_REQUESTED' && state !== 'COMMENTED') return null;

  // COMMENTED reviews with no inline comments have nothing actionable
  if (state === 'COMMENTED' && inlineComments.length === 0) return null;

  // Extract ticketId from branch name e.g. "qa/42-login-form" → "42"
  const branchMatch = payload.pull_request.head.ref.match(/^qa\/(\d+)-/);
  const ticketId = branchMatch ? branchMatch[1] : '';

  const comments: ReviewComment[] = inlineComments.map((c) => ({
    id: c.id,
    path: c.path,
    line: c.line,
    body: c.body,
    diffHunk: c.diff_hunk,
  }));

  return {
    prNumber: payload.pull_request.number,
    repo: payload.repository.name,
    outputRepo: payload.repository.name,
    branch: payload.pull_request.head.ref,
    ticketId,
    reviewId: payload.review.id,
    reviewerLogin: payload.review.user.login,
    comments,
    specPath,
  };
}
