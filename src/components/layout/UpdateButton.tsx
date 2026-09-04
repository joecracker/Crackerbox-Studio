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
    window.location.href = `${baseRef.current}?fresh=${Date.now()}`;
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
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        updateAvailable
          ? "bg-sky-500/15 text-sky-300"
          : status === "uptodate"
            ? "bg-emerald-500/15 text-emerald-300"
            : "text-zinc-300"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.5a5.5 5.5 0 1 1-4.8 8.2M3.5 13.5V9.8h3.7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}