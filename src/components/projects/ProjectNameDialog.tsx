import { useEffect, useRef, useState } from "react";

interface ProjectNameDialogProps {
  title: string;
  initialValue: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export default function ProjectNameDialog({
  title,
  initialValue,
  onSubmit,
  onClose,
}: ProjectNameDialogProps) {
  const [name, setName] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

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
        aria-labelledby="project-name-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <h2
            id="project-name-title"
            className="text-sm font-semibold uppercase tracking-wider text-zinc-300"
          >
            {title}
          </h2>
        </header>
        <div className="p-4">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Project name"
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim()}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
