import { flattenFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";
import { buildZip } from "./zip";
import {
  createRepo,
  getAuthenticatedUser,
  getFileSha,
  getRepo,
  uploadContentsFile,
} from "./github";
import {
  createPagesProject,
  deployToPages,
  getPagesProject,
  pollPagesDeployment,
} from "./cloudflare";

export interface DeployLogEntry {
  step: "prepare" | "github" | "cloudflare" | "done";
  message: string;
  ok?: boolean;
}

export interface DeployResult {
  repoUrl: string;
  siteUrl: string | null;
}

export interface DeployInput {
  projectName: string;
  files: DemoFile[];
  githubToken: string;
  cloudflareToken: string;
  repoPrivate: boolean;
  siteName: string;
  cfAccountId: string;
  /** true = needs an external host (Cloudflare Pages); false = served locally by Home Assistant (GitHub backup only). */
  hosted: boolean;
  /** Prefix for the git commit messages created by this push. */
  label?: string;
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "cracker-box";
}

/**
 * Pushes a project to GitHub + (when hosted) Cloudflare Pages. Idempotent:
 * if the repo or Pages project already exists they are reused, so repeated
 * runs act as updates rather than creating duplicates. Every file upload is
 * its own git commit tagged with `label`, giving you a per-push checkpoint
 * trail in GitHub history.
 *
 * Non-hosted (local) projects only push to GitHub for backup — Home Assistant
 * serves them itself, so no external host is used.
 */
export async function deployProject(
  input: DeployInput,
  onLog: (entry: DeployLogEntry) => void
): Promise<DeployResult> {
  const repoName = slugify(input.projectName);
  const siteName = slugify(input.siteName);
  const label = input.label ?? "Deploy";
  const files = flattenFiles(input.files).filter((f) => f.content != null);

  onLog({ step: "prepare", message: `Preparing ${files.length} files` });
  const zip = buildZip(input.files);
  onLog({ step: "prepare", message: `Built ${zip.size.toLocaleString()} byte archive` });

  onLog({ step: "github", message: `Checking GitHub repo "${repoName}"` });
  const user = await getAuthenticatedUser(input.githubToken);
  let repo = await getRepo(input.githubToken, user.login, repoName);
  if (repo) {
    onLog({ step: "github", message: `Reusing existing repo ${repo.full_name}`, ok: true });
  } else {
    repo = await createRepo(input.githubToken, repoName, input.repoPrivate);
    onLog({ step: "github", message: `Created repo "${repoName}"`, ok: true });
  }

  let uploaded = 0;
  for (const file of files) {
    const sha = await getFileSha(input.githubToken, user.login, repoName, file.path);
    await uploadContentsFile(
      input.githubToken,
      user.login,
      repoName,
      file.path,
      file.content ?? "",
      sha,
      `${label}: ${file.path}`
    );
    uploaded += 1;
    onLog({
      step: "github",
      message: `${sha ? "Updated" : "Added"} ${file.path} (${uploaded}/${files.length})`,
    });
  }

  let siteUrl: string | null = null;

  if (!input.hosted) {
    onLog({
      step: "done",
      message: "Local project — Home Assistant serves this itself. GitHub backup pushed; no external host used.",
      ok: true,
    });
    return { repoUrl: repo.html_url, siteUrl: null };
  }

  onLog({ step: "cloudflare", message: `Checking Cloudflare Pages project "${siteName}"` });
  let project = await getPagesProject(input.cloudflareToken, input.cfAccountId, siteName);
  if (project) {
    onLog({ step: "cloudflare", message: "Reusing existing Pages project", ok: true });
  } else {
    project = await createPagesProject(input.cloudflareToken, input.cfAccountId, siteName);
    onLog({ step: "cloudflare", message: `Created Pages project "${siteName}"`, ok: true });
  }

  onLog({ step: "cloudflare", message: "Uploading deploy archive" });
  const deployment = await deployToPages(
    input.cloudflareToken,
    input.cfAccountId,
    siteName,
    input.files
  );

  onLog({ step: "cloudflare", message: "Waiting for the build" });
  const result = await pollPagesDeployment(
    input.cloudflareToken,
    input.cfAccountId,
    siteName,
    deployment.id
  );

  siteUrl = result.url ?? deployment.url;
  onLog({ step: "done", message: `Live at ${siteUrl}`, ok: true });
  return { repoUrl: repo.html_url, siteUrl };
}

