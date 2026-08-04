import { useCallback, useEffect, useState } from "react";
import { normalizeModel, sortModels } from "../data/models";
import type { Model, OpenRouterModel } from "../data/models";

const MODELS_URL = "https://openrouter.ai/api/v1/models";

export interface UseModelsResult {
  models: Model[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useModels(): UseModelsResult {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const res = await fetch(MODELS_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as { data: unknown[] };
        const list = sortModels(
          (json.data ?? []).map((item) => normalizeModel(item as OpenRouterModel)),
        );
        if (!cancelled) setModels(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load models");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { models, loading, error, reload };
}
