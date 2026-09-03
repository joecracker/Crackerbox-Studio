import { useEffect, useState, useCallback } from "react";

interface OpenRouterCredits {
  totalCredits: number | null;
  totalUsage: number | null;
  remaining: number | null;
}

export type { OpenRouterCredits };

interface UseOpenRouterCredits {
  credits: OpenRouterCredits;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// OpenRouter credits endpoint: GET https://openrouter.ai/api/v1/credits
// Returns { data: { total_credits, total_usage, has_payment_method, ... } }
export function useOpenRouterCredits(apiKey: string | null): UseOpenRouterCredits {
  const [data, setData] = useState<OpenRouterCredits>({
    totalCredits: null,
    totalUsage: null,
    remaining: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiKey) {
      setData({ totalCredits: null, totalUsage: null, remaining: null });
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/credits", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`Credits request failed (${res.status})`);
      const json = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
      const total = json.data?.total_credits ?? null;
      const usage = json.data?.total_usage ?? null;
      setData({
        totalCredits: total,
        totalUsage: usage,
        remaining: total !== null && usage !== null ? total - usage : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credits");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { credits: data, loading, error, refresh: () => void load() };
}
