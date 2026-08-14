import { useCallback, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
import type { DemoFile } from "../data/demoFiles";
import { createFileSystemTree } from "../utils/webcontainerTree";

export interface WebContainerController {
  booting: boolean;
  ready: boolean;
  available: boolean;
  error: string | null;
  container: WebContainer | null;
  /** Key (active project id) the current container instance is mounted for. */
  projectKey: string | null;
  /**
   * Boot (or re-boot, when `token` differs from the mounted project) the container with the
   * given file tree. Returns the instance once it is usable, or `null` if unsupported.
   */
  boot: (files: DemoFile[], token?: string) => Promise<WebContainer | null>;
  /**
   * Resolves once the container has settled (booted, or confirmed unavailable/failed).
   * Returns the usable instance, or `null` when it can't be used — never throws.
   */
  whenReady: (timeoutMs?: number) => Promise<WebContainer | null>;
}

const DEFAULT_READY_TIMEOUT_MS = 10_000;

function crossOriginIsolated(): boolean {
  return typeof window !== "undefined" && typeof self !== "undefined"
    ? Boolean(self.crossOriginIsolated)
    : false;
}

export function useWebContainer(): WebContainerController {
  const [booting, setBooting] = useState(false);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [container, setContainer] = useState<WebContainer | null>(null);
  const containerRef = useRef<WebContainer | null>(null);
  const projectKeyRef = useRef<string | null>(null);
  const bootResultRef = useRef<Promise<WebContainer | null> | null>(null);

  const boot = useCallback(async (files: DemoFile[], token = ""): Promise<WebContainer | null> => {
    for (;;) {
      const current = containerRef.current;
      if (current && projectKeyRef.current === token) return current;
      const pending = bootResultRef.current;
      if (pending) {
        const result = await pending;
        if (containerRef.current && projectKeyRef.current === token) return result;
        continue;
      }
      break;
    }

    const previous = containerRef.current;
    if (previous) {
      containerRef.current = null;
      projectKeyRef.current = null;
      setContainer(null);
      setReady(false);
      try {
        previous.teardown();
      } catch {
        // already torn down
      }
    }

    setBooting(true);
    setError(null);
    setAvailable(true);
    const p = (async () => {
      if (!crossOriginIsolated()) {
        const msg =
          "WebContainers needs a cross-origin isolated page (COOP/COEP headers). Writes are disabled in this browser.";
        throw new Error(msg);
      }
      const instance = await WebContainer.boot();
      await instance.mount(createFileSystemTree(files));
      containerRef.current = instance;
      projectKeyRef.current = token;
      setContainer(instance);
      setReady(true);
      return instance;
    })();
    bootResultRef.current = p;
    try {
      const result = await p;
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "WebContainers failed to start";
      setError(message);
      setAvailable(false);
      return null;
    } finally {
      setBooting(false);
      if (bootResultRef.current === p) bootResultRef.current = null;
    }
  }, []);

  const whenReady = useCallback(
    async (timeoutMs: number = DEFAULT_READY_TIMEOUT_MS): Promise<WebContainer | null> => {
      const current = containerRef.current;
      if (current) return current;
      const pending = bootResultRef.current;
      if (!pending) return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      });
      try {
        return await Promise.race([pending, timedOut]);
      } catch {
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    []
  );

  return {
    booting,
    ready,
    available,
    error,
    container,
    projectKey: projectKeyRef.current,
    boot,
    whenReady,
  };
}