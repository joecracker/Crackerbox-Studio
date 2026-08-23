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
import { createDeploy, createSite, getSiteByName, pollDeploy } from "./netlify";

export interface DeployLogEntry {
  step: "prepare" | "github" | "netlify" | "done";
  message: string;
  ok?: boolean;
}

export interface DeployResult {
  repoUrl: string;
  siteUrl: string;
}

export interface DeployInput {
  projectName: string;
  files: DemoFile[];
  githubToken: string;
  netlifyToken: string;
  repoPrivate: boolean;
  siteName: string;
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
 * Pushes a project to GitHub + Netlify. Idempotent: if the repo or site
 * already exists they are reused, so repeated runs act as updates rather
 * than creating duplicates. Every file upload is its own git commit tagged
 * with `label`, giving you a per-push checkpoint trail in GitHub history.
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

  onLog({ step: "netlify", message: `Checking Netlify site "${siteName}"` });
  let site = await getSiteByName(input.netlifyToken, siteName);
  if (site) {
    onLog({ step: "netlify", message: "Reusing existing site", ok: true });
  } else {
    site = await createSite(input.netlifyToken, siteName);
    onLog({ step: "netlify", message: `Created Netlify site "${siteName}"`, ok: true });
  }

  onLog({ step: "netlify", message: "Uploading deploy archive" });
  const deploy = await createDeploy(input.netlifyToken, site.id, zip);

  onLog({ step: "netlify", message: "Waiting for the build" });
  const result = await pollDeploy(input.netlifyToken, deploy.id);

  const siteUrl = result.url ?? site.ssl_url;
  onLog({ step: "done", message: `Live at ${siteUrl}`, ok: true });
  return { repoUrl: repo.html_url, siteUrl };
}
