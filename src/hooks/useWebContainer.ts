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
  boot: (files: DemoFile[]) => Promise<WebContainer | null>;
}

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

  const boot = useCallback(async (files: DemoFile[]): Promise<WebContainer | null> => {
    if (containerRef.current) return containerRef.current;
    setBooting(true);
    setError(null);
    try {
      if (!crossOriginIsolated()) {
        const msg =
          "WebContainers needs a cross-origin isolated page (COOP/COEP headers). Writes are disabled in this browser.";
        setError(msg);
        setAvailable(false);
        return null;
      }
      const instance = await WebContainer.boot();
      await instance.mount(createFileSystemTree(files));
      containerRef.current = instance;
      setContainer(instance);
      setReady(true);
      setAvailable(true);
      return instance;
    } catch (e) {
      const message = e instanceof Error ? e.message : "WebContainers failed to start";
      setError(message);
      setAvailable(false);
      return null;
    } finally {
      setBooting(false);
    }
  }, []);

  return { booting, ready, available, error, container, boot };
}
