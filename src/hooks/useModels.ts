import { useCallback, useEffect, useState } from "react";
import { normalizeGoogleModel, normalizeModel, sortModels } from "../data/models";
import type { GoogleModel, Model, OpenRouterModel } from "../data/models";
import { providerConfig } from "../data/providers";
import type { ProviderId } from "../data/providers";

export interface UseModelsResult {
  models: Model[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useModels(providerId: ProviderId = "openrouter"): UseModelsResult {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    const config = providerConfig(providerId);

    const load = async () => {
      try {
        if (providerId === "google") {
          const res = await fetch(config.modelsUrl, { signal: controller.signal });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          const json = (await res.json()) as { models?: GoogleModel[] };
          const list = sortModels(
            (json.models ?? [])
              .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
              .map(normalizeGoogleModel)
          );
          if (!cancelled) setModels(list);
          return;
        }
        const res = await fetch(config.modelsUrl, { signal: controller.signal });
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
  }, [providerId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { models, loading, error, reload };
}