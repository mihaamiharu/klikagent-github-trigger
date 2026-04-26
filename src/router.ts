import { QATask, ReviewContext } from './types';
import { saveIssueRef, IssueRef } from './store';

function klikagentUrl(): string {
  return (process.env.KLIKAGENT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

function triggerUrl(): string {
  const port = process.env.PORT ?? '3001';
  return (process.env.TRIGGER_URL ?? `http://host.docker.internal:${port}`).replace(/\/$/, '');
}

async function post(path: string, body: unknown): Promise<void> {
  const url = `${klikagentUrl()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KlikAgent ${path} returned ${res.status}: ${text}`);
  }
}

/**
 * Forwards a QATask to KlikAgent's POST /tasks endpoint.
 * Stores the issue ref so the callback can comment on it later.
 */
export async function forwardTask(task: QATask, issueRef: IssueRef): Promise<void> {
  saveIssueRef(task.taskId, issueRef);

  const taskWithCallback: QATask = {
    ...task,
    callbackUrl: `${triggerUrl()}/callback/tasks/${task.taskId}/results`,
  };

  await post('/tasks', taskWithCallback);
}

/**
 * Forwards a ReviewContext to KlikAgent's POST /reviews endpoint.
 */
export async function forwardReview(ctx: ReviewContext): Promise<void> {
  await post('/reviews', ctx);
}
