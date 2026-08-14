import { useCallback, useEffect, useRef, useState } from "react";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";

export type PreviewStatus = "static" | "installing" | "starting" | "live" | "failed";

interface UsePreviewRuntimeOptions {
  container: WebContainer | null;
  ready: boolean;
  available: boolean;
  projectKey: string | null;
  /**
   * Bumped whenever the project files change; lets the runtime (re)start the dev
   * server once a previously non-runnable project gains a dev script.
   */
  mutationTick?: number;
}

interface PreviewRuntimeState {
  status: PreviewStatus;
  url: string | null;
  error: string | null;
}

const INSTALL_TIMEOUT_MS = 180_000;

function drain(proc: WebContainerProcess): void {
  const reader = proc.output.getReader();
  void (async () => {
    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // stream closed on kill
    }
  })();
}

async function spawnAndWait(
  wc: WebContainer,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<void> {
  const proc = await wc.spawn(command, args);
  drain(proc);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  try {
    const code = await proc.exit;
    if (code !== 0) {
      throw new Error(
        timedOut
          ? `${command} ${args.join(" ")} timed out after ${Math.round(timeoutMs / 1000)}s`
          : `${command} ${args.join(" ")} failed with exit code ${code}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

async function hasNodeModules(wc: WebContainer): Promise<boolean> {
  try {
    const entries = await wc.fs.readdir("/", { withFileTypes: true });
    return entries.some((e) => e.isDirectory() && e.name === "node_modules");
  } catch {
    return false;
  }
}

async function hasDevScript(wc: WebContainer): Promise<boolean> {
  try {
    const raw = await wc.fs.readFile("/package.json", "utf-8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return typeof pkg.scripts?.dev === "string";
  } catch {
    return false;
  }
}

export function usePreviewRuntime({
  container,
  ready,
  available,
  projectKey,
  mutationTick = 0,
}: UsePreviewRuntimeOptions): PreviewRuntimeState {
  const [status, setStatus] = useState<PreviewStatus>("static");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const procRef = useRef<WebContainerProcess | null>(null);
  const containerRef = useRef<WebContainer | null>(null);
  const projectKeyRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const subsRef = useRef<Array<() => void>>([]);

  const cleanup = useCallback(() => {
    startingRef.current = false;
    const proc = procRef.current;
    procRef.current = null;
    if (proc) {
      try {
        proc.kill();
      } catch {
        // already dead
      }
    }
    for (const unsub of subsRef.current) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    subsRef.current = [];
  }, []);

  const startDevServer = useCallback(
    async (wc: WebContainer, key: string) => {
      if (startingRef.current || procRef.current) return;
      startingRef.current = true;
      setStatus("installing");
      setUrl(null);
      setError(null);
      const subs: Array<() => void> = [];
      subsRef.current = subs;
      subs.push(
        wc.on("server-ready", (_port, serverUrl) => {
          setUrl(serverUrl);
          setStatus("live");
        })
      );
      subs.push(
        wc.on("error", (e) => {
          setError(e.message);
        })
      );
      try {
        if (!(await hasDevScript(wc))) {
          setStatus("static");
          return;
        }
        if (!(await hasNodeModules(wc))) {
          setStatus("installing");
          await spawnAndWait(wc, "npm", ["install"], INSTALL_TIMEOUT_MS);
        }
        setStatus("starting");
        const proc = await wc.spawn("npm", ["run", "dev"]);
        containerRef.current = wc;
        projectKeyRef.current = key;
        procRef.current = proc;
        drain(proc);
        void proc.exit.then((code) => {
          if (procRef.current !== proc) return;
          procRef.current = null;
          setStatus("failed");
          setError(`Dev server exited unexpectedly (exit code ${code}).`);
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to start the dev server";
        setStatus("failed");
        setError(message);
        cleanup();
      } finally {
        startingRef.current = false;
      }
    },
    [cleanup]
  );

  useEffect(() => {
    const wc = container;
    if (!wc || !ready || !available) {
      cleanup();
      containerRef.current = null;
      projectKeyRef.current = null;
      setStatus("static");
      setUrl(null);
      setError(null);
      return;
    }
    setStatus("installing");
    setUrl(null);
    setError(null);
    void startDevServer(wc, projectKey ?? "");
    return () => cleanup();
  }, [container, ready, available, projectKey, cleanup, startDevServer]);

  useEffect(() => {
    const wc = container;
    if (!wc || !ready || !available) return;
    if (procRef.current) return;
    void startDevServer(wc, projectKey ?? "");
  }, [mutationTick, container, ready, available, projectKey, startDevServer]);

  return { status, url, error };
}
