const GITHUB_API = "https://api.github.com";

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function ghFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

export async function getAuthenticatedUser(token: string): Promise<{ login: string }> {
  const res = await ghFetch(token, "/user");
  if (!res.ok) throw new Error(`GitHub auth failed (${res.status})`);
  return (await res.json()) as { login: string };
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean
): Promise<{ full_name: string; html_url: string }> {
  const res = await ghFetch(token, "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, private: isPrivate, auto_init: false }),
  });
  if (!res.ok) {
    throw new Error(`Create repo failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as { full_name: string; html_url: string };
}

export async function getRepo(
  token: string,
  owner: string,
  repo: string
): Promise<{ full_name: string; html_url: string } | null> {
  const res = await ghFetch(token, `/repos/${owner}/${repo}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Repo lookup failed (${res.status})`);
  return (await res.json()) as { full_name: string; html_url: string };
}

export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${encodePath(path)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed for ${path} (${res.status})`);
  const json = (await res.json()) as { sha: string } | { sha: string }[];
  const file = Array.isArray(json) ? json[0] : json;
  return file.sha;
}

export async function uploadContentsFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string | null,
  message = `Deploy ${path}`
): Promise<void> {
  const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(content),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Upload failed for ${path} (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}
