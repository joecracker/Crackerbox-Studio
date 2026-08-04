import { useEffect, useRef } from "react";
import type { Model } from "../../data/models";
import type { ParametersState } from "../../hooks/useParameters";

interface ParametersDialogProps {
  onClose: () => void;
  parameters: ParametersState;
  models: Model[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

function formatPrice(price: number): string {
  const perMillion = price * 1_000_000;
  return `$${perMillion.toFixed(2)}/M`;
}

export default function ParametersDialog({
  onClose,
  parameters,
  models,
  loading,
  error,
  onReload,
}: ParametersDialogProps) {
  const {
    selectedModelId,
    setSelectedModelId,
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    freeOnly,
    setFreeOnly,
  } = parameters;

  const closeRef = useRef<HTMLButtonElement>(null);
  const list = freeOnly ? models.filter((m) => m.isFree) : models;
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectDisabled = loading || models.length === 0;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (loading || list.length === 0) return;
    if (!list.some((m) => m.id === selectedModelId)) {
      setSelectedModelId(list[0].id);
    }
  }, [list, loading, selectedModelId, setSelectedModelId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parameters-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="flex max-h-[85vh] w-[540px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <h2
            id="parameters-title"
            className="text-sm font-semibold uppercase tracking-wider text-zinc-300"
          >
            Parameters
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close parameters"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 py-4">
          <label
            htmlFor="param-model"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Model
          </label>
          <select
            id="param-model"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            disabled={selectDisabled}
            className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <option value="">Loading models…</option>
            ) : models.length === 0 ? (
              <option value="">Couldn't load models</option>
            ) : (
              list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.provider}
                  {m.isFree ? " (Free)" : ""}
                </option>
              ))
            )}
          </select>
          {!loading && error && models.length === 0 && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-red-400">{error}</span>
              <button
                type="button"
                onClick={onReload}
                className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Retry
              </button>
            </div>
          )}
          {selectedModel && (
            <p className="mt-1.5 text-[11px] text-zinc-500">
              {selectedModel.provider}
              {selectedModel.isFree ? (
                <span className="ml-2 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Free
                </span>
              ) : (
                <span className="ml-2 tabular-nums">
                  {formatPrice(selectedModel.promptPrice)} in · {formatPrice(selectedModel.completionPrice)} out
                </span>
              )}
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => setFreeOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-sky-500"
            />
            Free models only
          </label>
          <label
            htmlFor="param-system"
            className="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            System prompt
          </label>
          <textarea
            id="param-system"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder="You are a helpful assistant..."
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="param-temp"
                className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Temperature
              </label>
              <span className="text-xs tabular-nums text-zinc-400">{temperature.toFixed(1)}</span>
            </div>
            <input
              id="param-temp"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>
          <div className="mt-4">
            <label
              htmlFor="param-tokens"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              Max tokens
            </label>
            <input
              id="param-tokens"
              type="number"
              min={1}
              max={100000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
