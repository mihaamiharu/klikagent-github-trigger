// GitHub API helpers for the trigger service

function githubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is not set');
  return token;
}

async function ghRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

export async function commentOnIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const res = await ghRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`commentOnIssue ${issueNumber}: ${res.status} ${text}`);
  }
}

export async function addLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const res = await ghRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`addLabel ${label} on #${issueNumber}: ${res.status} ${text}`);
  }
}

export async function removeLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const encodedLabel = encodeURIComponent(label);
  const res = await ghRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodedLabel}`,
    { method: 'DELETE' },
  );
  // 404 = label wasn't on the issue — not an error
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`removeLabel ${label} on #${issueNumber}: ${res.status} ${text}`);
  }
}

export async function transitionToInQA(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await removeLabel(owner, repo, issueNumber, 'status:ready-for-qa');
  await addLabel(owner, repo, issueNumber, 'status:in-qa');
}
