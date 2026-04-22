import { QATask, ReviewContext } from './types';

function klikagentUrl(): string {
  return (process.env.KLIKAGENT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
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
 * KlikAgent responds 202 and processes asynchronously.
 */
export async function forwardTask(task: QATask): Promise<void> {
  await post('/tasks', task);
}

/**
 * Forwards a ReviewContext to KlikAgent's POST /reviews endpoint.
 */
export async function forwardReview(ctx: ReviewContext): Promise<void> {
  await post('/reviews', ctx);
}
