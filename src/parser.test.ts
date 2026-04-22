import { parseIssuePayload, parseReviewPayload } from './parser';
import { GitHubIssuePayload, GitHubPRReviewPayload, GitHubReviewComment } from './types';

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...OLD_ENV,
    QA_ENV_URL: 'https://qa.example.com',
    GITHUB_TEST_REPO: 'klikagent-tests',
  };
});

afterEach(() => {
  process.env = OLD_ENV;
});

// ─── parseIssuePayload ────────────────────────────────────────────────────────

function makeIssuePayload(overrides: Partial<GitHubIssuePayload> = {}): GitHubIssuePayload {
  return {
    action: 'labeled',
    label: { name: 'status:ready-for-qa' },
    issue: {
      number: 42,
      title: 'Login form validation',
      body: '## Acceptance Criteria\nUser can log in',
      html_url: 'https://github.com/org/qa-repo/issues/42',
      labels: [{ name: 'status:ready-for-qa' }],
    },
    repository: { name: 'qa-repo', full_name: 'org/qa-repo' },
    ...overrides,
  };
}

describe('parseIssuePayload', () => {
  it('returns QATask for status:ready-for-qa labeled event', () => {
    const task = parseIssuePayload(makeIssuePayload());

    expect(task).not.toBeNull();
    expect(task?.taskId).toBe('42');
    expect(task?.title).toBe('Login form validation');
    expect(task?.description).toBe('## Acceptance Criteria\nUser can log in');
    expect(task?.qaEnvUrl).toBe('https://qa.example.com');
    expect(task?.outputRepo).toBe('klikagent-tests');
    expect(task?.metadata?.issueUrl).toBe('https://github.com/org/qa-repo/issues/42');
  });

  it('returns null for non-labeled action', () => {
    const result = parseIssuePayload(makeIssuePayload({ action: 'opened' }));
    expect(result).toBeNull();
  });

  it('returns null when label is not status:ready-for-qa', () => {
    const payload = makeIssuePayload();
    payload.label = { name: 'status:in-progress' };
    expect(parseIssuePayload(payload)).toBeNull();
  });

  it('returns null when label is missing', () => {
    const payload = makeIssuePayload();
    delete payload.label;
    expect(parseIssuePayload(payload)).toBeNull();
  });

  it('extracts feature from feature:* label', () => {
    const payload = makeIssuePayload();
    payload.issue.labels = [
      { name: 'status:ready-for-qa' },
      { name: 'feature:auth' },
    ];
    const task = parseIssuePayload(payload);
    expect(task?.feature).toBe('auth');
  });

  it('leaves feature undefined when no feature:* label', () => {
    const task = parseIssuePayload(makeIssuePayload());
    expect(task?.feature).toBeUndefined();
  });

  it('handles null issue body gracefully', () => {
    const payload = makeIssuePayload();
    payload.issue.body = null;
    const task = parseIssuePayload(payload);
    expect(task?.description).toBe('');
  });
});

// ─── parseReviewPayload ───────────────────────────────────────────────────────

function makeReviewPayload(overrides: Partial<GitHubPRReviewPayload> = {}): GitHubPRReviewPayload {
  return {
    action: 'submitted',
    review: {
      id: 99,
      state: 'CHANGES_REQUESTED',
      user: { login: 'reviewer-jane' },
      body: 'Please fix the selector',
    },
    pull_request: {
      number: 5,
      draft: false,
      head: { ref: 'qa/42-login-form-validation' },
    },
    repository: { name: 'klikagent-tests', full_name: 'org/klikagent-tests' },
    ...overrides,
  };
}

const mockComments: GitHubReviewComment[] = [
  { id: 1, path: 'tests/web/general/42.spec.ts', line: 10, body: 'Wrong selector', diff_hunk: '@@ -1,1 +1,2 @@' },
];

describe('parseReviewPayload', () => {
  it('returns ReviewContext for CHANGES_REQUESTED', () => {
    const ctx = parseReviewPayload(makeReviewPayload(), mockComments);

    expect(ctx).not.toBeNull();
    expect(ctx?.prNumber).toBe(5);
    expect(ctx?.branch).toBe('qa/42-login-form-validation');
    expect(ctx?.taskId).toBe('42');
    expect(ctx?.reviewId).toBe(99);
    expect(ctx?.reviewerLogin).toBe('reviewer-jane');
    expect(ctx?.comments).toHaveLength(1);
    expect(ctx?.comments[0].body).toBe('Wrong selector');
    expect(ctx?.comments[0].diffHunk).toBe('@@ -1,1 +1,2 @@');
  });

  it('returns null for non-submitted action', () => {
    const result = parseReviewPayload(makeReviewPayload({ action: 'dismissed' }), []);
    expect(result).toBeNull();
  });

  it('returns null when state is not CHANGES_REQUESTED', () => {
    const payload = makeReviewPayload();
    payload.review.state = 'APPROVED';
    expect(parseReviewPayload(payload, [])).toBeNull();
  });

  it('extracts taskId from branch name', () => {
    const payload = makeReviewPayload();
    payload.pull_request.head.ref = 'qa/123-some-feature';
    const ctx = parseReviewPayload(payload, []);
    expect(ctx?.taskId).toBe('123');
  });

  it('handles empty inline comments', () => {
    const ctx = parseReviewPayload(makeReviewPayload(), []);
    expect(ctx?.comments).toEqual([]);
  });
});
