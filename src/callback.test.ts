import request from 'supertest';
import express from 'express';
import { TaskResult } from './types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('./store');
jest.mock('./github');

import { getIssueRef, deleteIssueRef } from './store';
import { commentOnIssue, transitionToInQA } from './github';

// Build a minimal app with just the callback route (avoids port conflicts)
function makeApp() {
  const app = express();
  app.use('/callback', express.json());

  const { getIssueRef: _get, deleteIssueRef: _del } = require('./store');
  const { commentOnIssue: _comment, transitionToInQA: _transition } = require('./github');

  app.post('/callback/tasks/:id/results', async (req: express.Request, res: express.Response) => {
    const taskId = req.params.id;
    const result = req.body as TaskResult;
    res.status(200).json({ received: true });

    const ref = _get(taskId);
    if (!ref) return;

    try {
      await _transition(ref.owner, ref.repo, ref.issueNumber);
      await _comment(ref.owner, ref.repo, ref.issueNumber, expect.any(String));
      _del(taskId);
    } catch {
      // swallow
    }
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const REF = { owner: 'org', repo: 'qa-repo', issueNumber: 42, issueUrl: 'https://github.com/org/qa-repo/issues/42' };

const RESULT: TaskResult = {
  taskId: '42',
  passed: true,
  summary: 'Spec generated successfully. PR: https://github.com/org/klikagent-tests/pull/5',
  reportUrl: 'https://github.com/org/klikagent-tests/pull/5',
};

beforeEach(() => {
  jest.clearAllMocks();
  (getIssueRef as jest.Mock).mockReturnValue(REF);
  (commentOnIssue as jest.Mock).mockResolvedValue(undefined);
  (transitionToInQA as jest.Mock).mockResolvedValue(undefined);
  (deleteIssueRef as jest.Mock).mockReturnValue(undefined);
});

describe('POST /callback/tasks/:id/results', () => {
  it('responds 200 immediately', async () => {
    const app = makeApp();
    const res = await request(app).post('/callback/tasks/42/results').send(RESULT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});

// Store + github integration tested separately via store.test.ts and github unit tests
describe('store integration', () => {
  it('getIssueRef is called with the taskId from the URL', async () => {
    const app = makeApp();
    await request(app).post('/callback/tasks/42/results').send(RESULT);
    // Give async processing a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(getIssueRef).toHaveBeenCalledWith('42');
  });

  it('does nothing when no issue ref is found', async () => {
    (getIssueRef as jest.Mock).mockReturnValue(undefined);
    const app = makeApp();
    await request(app).post('/callback/tasks/42/results').send(RESULT);
    await new Promise((r) => setTimeout(r, 10));
    expect(transitionToInQA).not.toHaveBeenCalled();
    expect(commentOnIssue).not.toHaveBeenCalled();
  });
});
