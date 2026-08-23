const NETLIFY_API = "https://api.netlify.com/api/v1";

async function netlifyFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${NETLIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function createSite(
  token: string,
  name: string
): Promise<{ id: string; url: string; ssl_url: string }> {
  const res = await netlifyFetch(token, "/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Create site failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { id: string; url: string; ssl_url: string };
}

/** Finds an existing site by exact name, or returns null when absent. */
export async function getSiteByName(
  token: string,
  name: string
): Promise<{ id: string; url: string; ssl_url: string } | null> {
  const res = await netlifyFetch(token, `/sites?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Site lookup failed (${res.status})`);
  const sites = (await res.json()) as Array<{ name: string; id: string; url: string; ssl_url: string }>;
  const match = sites.find((s) => s.name === name);
  return match ? { id: match.id, url: match.url, ssl_url: match.ssl_url } : null;
}

export async function createDeploy(
  token: string,
  siteId: string,
  zip: Blob
): Promise<{ id: string }> {
  const res = await netlifyFetch(token, `/sites/${siteId}/deploys`, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zip,
  });
  if (!res.ok) throw new Error(`Deploy failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { id: string };
}

export async function pollDeploy(
  token: string,
  deployId: string,
  onTick?: (state: string) => void
): Promise<{ state: string; url?: string }> {
  for (let i = 0; i < 60; i++) {
    const res = await netlifyFetch(token, `/deploys/${deployId}`);
    if (!res.ok) throw new Error(`Status check failed (${res.status})`);
    const json = (await res.json()) as { state: string; url?: string };
    onTick?.(json.state);
    if (json.state === "ready") return json;
    if (json.state === "error") throw new Error("Netlify build failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for the deploy to build");
}
