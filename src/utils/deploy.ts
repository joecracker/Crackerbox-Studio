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

export interface DeployLogEntry {
  step: "prepare" | "github" | "done";
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
  repoPrivate: boolean;
  siteName: string;
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
 * Pushes a project to GitHub. Idempotent: if the repo already exists it is
 * reused, so repeated runs act as updates rather than creating duplicates.
 * Every file upload is its own git commit tagged with `label`, giving you
 * a per-push checkpoint trail in GitHub history.
 *
 * For hosted projects, pushing to GitHub automatically triggers Cloudflare Pages.
 * For local projects, GitHub serves as a secure backup for Home Assistant.
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

  if (!input.hosted) {
    onLog({
      step: "done",
      message: "Local project — Home Assistant serves this itself. GitHub backup pushed; no external host used.",
      ok: true,
    });
    return { repoUrl: repo.html_url, siteUrl: null };
  }

  const siteUrl = `https://${siteName}.pages.dev`;
  onLog({
    step: "done",
    message: `Pushed to GitHub! Cloudflare Pages is auto-deploying your site at ${siteUrl}`,
    ok: true,
  });
  return { repoUrl: repo.html_url, siteUrl };
}
