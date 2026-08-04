interface TokenCounterProps {
  count?: number;
}

export default function TokenCounter({ count = 0 }: TokenCounterProps) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500" aria-live="polite">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M8 4.5v3.5l2.5 1.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{count.toLocaleString()} tokens</span>
    </div>
  );
}
