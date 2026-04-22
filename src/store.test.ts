import { saveIssueRef, getIssueRef, deleteIssueRef } from './store';

const REF = { owner: 'org', repo: 'qa-repo', issueNumber: 42, issueUrl: 'https://github.com/org/qa-repo/issues/42' };

describe('store', () => {
  afterEach(() => {
    deleteIssueRef('42');
  });

  it('returns undefined for unknown taskId', () => {
    expect(getIssueRef('99')).toBeUndefined();
  });

  it('saves and retrieves an issue ref', () => {
    saveIssueRef('42', REF);
    expect(getIssueRef('42')).toEqual(REF);
  });

  it('deletes an issue ref', () => {
    saveIssueRef('42', REF);
    deleteIssueRef('42');
    expect(getIssueRef('42')).toBeUndefined();
  });

  it('overwrites an existing ref', () => {
    saveIssueRef('42', REF);
    const updated = { ...REF, issueNumber: 99 };
    saveIssueRef('42', updated);
    expect(getIssueRef('42')?.issueNumber).toBe(99);
  });
});
