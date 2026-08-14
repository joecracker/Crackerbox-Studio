import { useState } from "react";
import type { PreviewStatus } from "../../hooks/usePreviewRuntime";

interface PreviewCanvasProps {
  srcDoc?: string | null;
  previewUrl?: string | null;
  previewStatus?: PreviewStatus;
  busy?: boolean;
}

export default function PreviewCanvas({
  srcDoc = null,
  previewUrl = null,
  previewStatus = "static",
  busy = false,
}: PreviewCanvasProps) {
  const [nonce, setNonce] = useState(0);
  const live = previewStatus === "live" && previewUrl !== null;

  if (!live && !srcDoc) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-700">
          <p className="max-w-xs text-center text-sm text-zinc-500">
            {busy
              ? "Generating your app…"
              : previewStatus === "installing" || previewStatus === "starting"
                ? "Starting the project's dev server…"
                : "Ask the assistant to generate code — it will render right here, live."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      {live ? (
        <iframe
          key={nonce}
          title="Live preview"
          sandbox="allow-scripts allow-same-origin"
          src={previewUrl ?? ""}
          className="h-full w-full border-0 bg-white"
        />
      ) : (
        <iframe
          key={nonce}
          title="Live preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc ?? undefined}
          className="h-full w-full border-0 bg-white"
        />
      )}
      <button
        type="button"
        onClick={() => setNonce((n) => n + 1)}
        title="Reload preview"
        aria-label="Reload preview"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/90 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path d="M13.2 1.8v2.8h-2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {busy && !live && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-zinc-950/70 to-transparent pb-1.5 pt-6">
          <span className="rounded-sm bg-zinc-900/90 px-2 py-0.5 text-[10px] text-zinc-300">
            regenerating… the preview updates when the reply finishes
          </span>
        </div>
      )}
    </div>
  );
}
