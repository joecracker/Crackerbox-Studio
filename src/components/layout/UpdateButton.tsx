import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

function currentAsset(): string | null {
  return (
    typeof document !== "undefined"
      ? document.querySelector('script[src*="/assets/"]')?.getAttribute("src")
      : null
  ) ?? null;
}

async function remoteAsset(base: string): Promise<string | null> {
  const res = await fetch(`${base}?fresh=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  return match?.[0] ?? null;
}

export default function UpdateButton() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "uptodate">("idle");
  const baseRef = useRef<string>(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  const reloadFresh = useCallback(() => {
    // Bypass any service-worker cache entirely: unregister SWs, then hard-load.
    if ("serviceWorker" in navigator && "caches" in window) {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {
          // best effort — reload still happens below
        }
        window.location.replace(window.location.href.split("?")[0] + "?fresh=" + Date.now());
      })();
      return;
    }
    window.location.replace(window.location.href.split("?")[0] + "?fresh=" + Date.now());
  }, []);

  const check = useCallback(async (flashWhenUpToDate = false): Promise<boolean> => {
    try {
      const current = currentAsset();
      if (!current) return false;
      const remote = await remoteAsset(baseRef.current);
      if (!remote) return false;
      if (remote !== current) {
        setUpdateAvailable(true);
        setStatus("idle");
        return true;
      }
      if (flashWhenUpToDate) {
        setStatus("uptodate");
        setTimeout(() => setStatus("idle"), 2000);
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(t);
  }, [check]);

  const handleClick = () => {
    if (updateAvailable) {
      reloadFresh();
      return;
    }
    setStatus("checking");
    void check(true).then((found) => {
      if (found) {
        setTimeout(reloadFresh, 400);
      } else {
        setStatus("idle");
      }
    });
  };

  const title = updateAvailable
    ? "New build is live — tap to reload"
    : status === "uptodate"
      ? "You're up to date"
      : "Check for updates";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      aria-live="polite"
      className={`flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        updateAvailable
          ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50"
          : status === "uptodate"
            ? "bg-emerald-500/20 text-emerald-200"
            : status === "checking"
              ? "bg-zinc-800 text-zinc-300"
              : "text-zinc-300"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={status === "checking" ? "animate-spin" : ""}>
        <path
          d="M8 2.5a5.5 5.5 0 1 1-4.8 8.2M3.5 13.5V9.8h3.7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {updateAvailable && <span className="text-[10px] font-semibold tracking-wide">Update</span>}
      {status === "uptodate" && <span className="text-[10px] font-semibold tracking-wide">Up to date</span>}
    </button>
  );
}