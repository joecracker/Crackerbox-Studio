import { usePersistentState } from "./usePersistentState";

const BROWSER_KEY = "crackerbox.preview.browser";

export type PreviewBrowserMode = "app" | "web";

export const GITHUB_HOME = "https://github.com";
export const GITHUB_REPO = "https://github.com/joecracker/Crackerbox-Studio";

interface PreviewBrowserState {
  mode: PreviewBrowserMode;
  url: string;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function usePreviewBrowser() {
  const [state, setState] = usePersistentState<PreviewBrowserState>(BROWSER_KEY, {
    mode: "app",
    url: "",
  });

  const showApp = () => setState((prev) => ({ ...prev, mode: "app" }));

  const openUrl = (raw: string) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    setState({ mode: "web", url });
  };

  return {
    mode: state.mode,
    url: state.url,
    showApp,
    openUrl,
  };
}

export type PreviewBrowser = ReturnType<typeof usePreviewBrowser>;