import { flattenFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";
import { buildZip } from "./zip";

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

interface PagesProject {
  name: string;
  subdomain: string;
  domains: string[];
}

/** Returns the project if it exists, otherwise null. */
export async function getPagesProject(
  token: string,
  accountId: string,
  projectName: string
): Promise<PagesProject | null> {
  const res = await cfFetch(token, `/accounts/${accountId}/pages/projects/${projectName}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudflare project lookup failed (${res.status})`);
  const json = (await res.json()) as { result: PagesProject };
  return json.result;
}

/** Creates a direct-upload Pages project (no repo connection needed). */
export async function createPagesProject(
  token: string,
  accountId: string,
  projectName: string
): Promise<PagesProject> {
  const res = await cfFetch(token, `/accounts/${accountId}/pages/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName, production_branch: "main" }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Cloudflare create project failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { result: PagesProject };
  return json.result;
}

export interface PagesDeployment {
  id: string;
  url: string;
  status: string;
}

/** Direct-uploads a project's files as a new Cloudflare Pages deployment. */
export async function deployToPages(
  token: string,
  accountId: string,
  projectName: string,
  files: DemoFile[]
): Promise<PagesDeployment> {
  const flat = flattenFiles(files).filter((f) => f.content != null);
  const manifest: Record<string, string> = {};
  for (const f of flat) {
    manifest[f.path] = await sha256Hex(f.content ?? "");
  }
  const zip = buildZip(files);

  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("files", zip, "files.zip");

  const res = await cfFetch(token, `/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Cloudflare deploy failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { result: PagesDeployment };
  return json.result;
}

export async function pollPagesDeployment(
  token: string,
  accountId: string,
  projectName: string,
  deploymentId: string,
  onTick?: (status: string) => void
): Promise<PagesDeployment> {
  for (let i = 0; i < 90; i++) {
    const res = await cfFetch(
      token,
      `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`
    );
    if (!res.ok) throw new Error(`Cloudflare status check failed (${res.status})`);
    const json = (await res.json()) as { result: PagesDeployment };
    onTick?.(json.result.status);
    if (json.result.status === "success") return json.result;
    if (json.result.status === "failure") throw new Error("Cloudflare build failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for the Cloudflare deployment");
}
