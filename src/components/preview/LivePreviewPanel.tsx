import PanelResizer from "../layout/PanelResizer";
import PreviewCanvas from "./PreviewCanvas";

interface LivePreviewPanelProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
}

export default function LivePreviewPanel({ width, minWidth, maxWidth, onResize }: LivePreviewPanelProps) {
  return (
    <>
      <PanelResizer
        width={width}
        minWidth={minWidth}
        maxWidth={maxWidth}
        onResize={onResize}
        invert
        label="Resize live preview"
      />
      <section
        aria-label="Live preview"
        className="flex min-w-0 flex-col border-l border-zinc-800 bg-zinc-950"
        style={{ width }}
      >
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Live Preview</span>
          <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            placeholder
          </span>
        </header>
        <PreviewCanvas />
      </section>
    </>
  );
}
