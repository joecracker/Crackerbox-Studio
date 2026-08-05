import { flattenFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";
import { buildZip } from "./zip";
import { createRepo, getAuthenticatedUser, getFileSha, uploadContentsFile } from "./github";
import { createDeploy, createSite, pollDeploy } from "./netlify";

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
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "cracker-box";
}

export async function deployProject(
  input: DeployInput,
  onLog: (entry: DeployLogEntry) => void
): Promise<DeployResult> {
  const repoName = slugify(input.projectName);
  const siteName = slugify(input.siteName);
  const files = flattenFiles(input.files).filter((f) => f.content != null);

  onLog({ step: "prepare", message: `Preparing ${files.length} files` });
  const zip = buildZip(input.files);
  onLog({ step: "prepare", message: `Built ${zip.size.toLocaleString()} byte archive` });

  onLog({ step: "github", message: `Creating GitHub repo "${repoName}"` });
  const user = await getAuthenticatedUser(input.githubToken);
  const repo = await createRepo(input.githubToken, repoName, input.repoPrivate);

  let uploaded = 0;
  for (const file of files) {
    const sha = await getFileSha(input.githubToken, user.login, repoName, file.path);
    await uploadContentsFile(
      input.githubToken,
      user.login,
      repoName,
      file.path,
      file.content ?? "",
      sha
    );
    uploaded += 1;
    onLog({ step: "github", message: `Uploaded ${file.path} (${uploaded}/${files.length})` });
  }

  onLog({ step: "netlify", message: `Creating Netlify site "${siteName}"` });
  const site = await createSite(input.netlifyToken, siteName);

  onLog({ step: "netlify", message: "Uploading deploy archive" });
  const deploy = await createDeploy(input.netlifyToken, site.id, zip);

  onLog({ step: "netlify", message: "Waiting for the build" });
  const result = await pollDeploy(input.netlifyToken, deploy.id);

  const siteUrl = result.url ?? site.ssl_url;
  onLog({ step: "done", message: `Live at ${siteUrl}`, ok: true });
  return { repoUrl: repo.html_url, siteUrl };
}
