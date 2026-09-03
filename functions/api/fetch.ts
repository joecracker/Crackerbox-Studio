// Cloudflare Pages Function — fetch proxy for Cracker Box "God Mode" tools.
//
// The chat agent needs to reach the open web and GitHub from a browser
// sandbox (no CORS, no server). This function relays safe GET/POST fetches
// through Cracker Box's own backend and returns the raw body,
// so web_fetch + git_clone work from the chat.

interface Env {}

const BLOCKED_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"0.0.0.0",
	"169.254.169.254", // cloud metadata
]);
function isBlocked(urlStr: string): string | null {
	let url: URL;
	try {
		url = new URL(urlStr);
	} catch {
		return "Invalid URL.";
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return "Only http/https URLs are allowed.";
	}
	const host = url.hostname.toLowerCase();
	if (host.endsWith(".localhost") || host === "" || BLOCKED_HOSTS.has(host)) {
		return "This host is blocked by the fetch proxy.";
	}
	// Private/loopback/link-local hostname guards.
	if (host.endsWith(".internal") || host.endsWith(".local") || host.endsWith(".home.arpa") || host === "host.docker.internal") {
		return "This host is blocked by the fetch proxy.";
	}
	if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) return "Private IPs are blocked.";
	if (host.startsWith("127.") || host.startsWith("169.254.")) return "Private IPs are blocked.";
	// Masked .ui.nabu.casa (your HA) — keep it out of the generic proxy.
	if (host.endsWith(".ui.nabu.casa")) return "Use the Home Assistant MCP, not the fetch proxy, for Nabu Casa.";
	return null;
}

export const onRequestPost = async ({
	request,
}: { request: Request; env: Env }): Promise<Response> => {
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "Invalid JSON body." }, { status: 400 });
		}
		const urlStr = (body as { url?: string }).url ?? "";
		if (!urlStr || typeof urlStr !== "string") {
			return Response.json({ error: "Missing 'url'." }, { status: 400 });
		}
		const blocked = isBlocked(urlStr);
		if (blocked) return Response.json({ error: blocked }, { status: 403 });

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 45_000);
		try {
			const res = await fetch(urlStr, {
				method: "GET",
				redirect: "follow",
				headers: {
					"User-Agent": "CrackerBox/GodMode",
					Accept: "text/html,application/xhtml+xml,text/plain,application/json,*/*;q=0.8",
				},
				signal: controller.signal,
			});
			if (!res.ok) {
				return Response.json({ error: `Upstream returned HTTP ${res.status}.` }, { status: 502 });
			}
			const contentType = res.headers.get("content-type") ?? "";
			if (contentType.includes("json")) {
				const text = await res.text();
				return Response.json({ ok: true, content: text }, { headers: { "Cache-Control": "no-store" } });
			}
			// Clamp large bodies so we don't blow memory.
			const text = (await res.text()).slice(0, 900_000);
			// Crude HTML→text shrinklet: strip tags so readability stays usable.
			const plain = contentType.includes("html")
				? text
						.replace(/<script[\s\S]*?<\/script>/gi, " ")
						.replace(/<style[\s\S]*?<\/style>/gi, " ")
						.replace(/<[^>]+>/g, " ")
						.replace(/\s{3,}/g, "\n")
						.trim()
				: text;
			return Response.json({ ok: true, content: plain.slice(0, 900_000) }, { headers: { "Cache-Control": "no-store" } });
		} finally {
			clearTimeout(timer);
		}
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? `Fetch proxy error: ${e.message}` : "Fetch proxy error." },
			{ status: 502 },
		);
	}
};