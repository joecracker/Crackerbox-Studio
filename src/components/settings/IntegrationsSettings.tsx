import type { McpController } from "../../hooks/useMcp";
import type { TokenVault } from "../../hooks/useTokenVault";

interface IntegrationsSettingsProps {
  mcp: McpController;
  vault: TokenVault;
}

export default function IntegrationsSettings({ mcp, vault }: IntegrationsSettingsProps) {
  const hasToken = vault.hasStored("homeassistant") || !!vault.tokens.homeassistant;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Home Assistant (MCP)
          </h3>
          {mcp.connected ? (
            <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              connected
            </span>
          ) : (
            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
              disconnected
            </span>
          )}
        </div>

        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          Connect to your Home Assistant MCP server so the chat can read entity states, call
          services, and build dashboards from real data. Works over Nabu Casa — no Home Assistant
          tab needed, just your HA instance running.
        </p>

        <label
          htmlFor="mcp-url"
          className="mb-1 mt-3 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
        >
          MCP server URL (Nabu Casa)
        </label>
        <input
          id="mcp-url"
          value={mcp.url}
          onChange={(e) => mcp.setUrl(e.target.value)}
          placeholder="https://your-instance.ui.nabu.casa/api/mcp"
          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />

        <div className="mt-3 flex items-center gap-2">
          {mcp.connected ? (
            <button
              type="button"
              onClick={mcp.disconnect}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void mcp.connect()}
              disabled={mcp.connecting || !mcp.url.trim()}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mcp.connecting ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
        {!hasToken && (
          <p className="mt-2 text-[11px] text-amber-400">
            Add your Home Assistant long-lived token in Deploy → Connect accounts, then connect.
            The token is required for Nabu Casa.
          </p>
        )}
        {mcp.error && <p className="mt-2 break-words text-[11px] text-red-400">{mcp.error}</p>}

        {mcp.connected && (
          <div className="mt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Available tools ({mcp.tools.length})
            </p>
            {mcp.tools.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No tools exposed by this server.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {mcp.tools.map((t) => (
                  <li
                    key={t.name}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1"
                  >
                    <span className="font-mono text-[11px] text-sky-300">{t.name}</span>
                    {t.description && (
                      <span className="ml-2 text-[10px] text-zinc-500">{t.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}