export default function PreviewCanvas() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-6">
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-700">
        <p className="max-w-xs text-center text-sm text-zinc-500">Your live preview will render here.</p>
      </div>
    </div>
  );
}
