// In-memory store: taskId → originating issue metadata
// Populated when we forward a task to KlikAgent; consumed when KlikAgent
// POSTs the result back via the callback endpoint.

export interface IssueRef {
  owner: string;
  repo: string;
  issueNumber: number;
  issueUrl: string;
}

const store = new Map<string, IssueRef>();

export function saveIssueRef(taskId: string, ref: IssueRef): void {
  store.set(taskId, ref);
}

export function getIssueRef(taskId: string): IssueRef | undefined {
  return store.get(taskId);
}

export function deleteIssueRef(taskId: string): void {
  store.delete(taskId);
}
