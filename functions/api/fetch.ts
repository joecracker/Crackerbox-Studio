// Cloudflare Pages Function — God Mode proxy for Cracker Box.
//
// Provides three capabilities to the in-app chat agent:
//   1. fetch  : { url }      — read the text of any public page/URL
//   2. search : { search }   — web search (DuckDuckGo HTML, parsed to results)
//   3. github : optional "authorization" forwarded to api/raw.githubusercontent
//                so git_clone can hit PRIVATE repos with the user's token.
//
// Private hosts and metadata endpoints are blocked.

interface Env {}

const BLOCKED_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"0.0.0.0",
	"169.254.169.254",
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
	if (
		host.endsWith(".internal") ||
		host.endsWith(".local") ||
		host.endsWith(".home.arpa") ||
		host === "host.docker.internal"
	) {
		return "This host is blocked by the fetch proxy.";
	}
	if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) return "Private IPs are blocked.";
	if (host.startsWith("127.") || host.startsWith("169.254.")) return "Private IPs are blocked.";
	if (host.endsWith(".ui.nabu.casa")) return "Use the Home Assistant MCP, not the fetch proxy, for Nabu Casa.";
	return null;
}

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s{3,}/g, "\n")
		.trim();
}

function decodeEntity(s: string): string {
	return s
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'");
}

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

// Parse DuckDuckGo HTML results into structured results.
function parseDdgResults(html: string): SearchResult[] {
	const out: SearchResult[] = [];
	const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	const snipRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
	const titles: Array<{ url: string; title: string }> = [];
	let m: RegExpExecArray | null;
	while ((m = linkRe.exec(html)) !== null) {
		let url = m[1];
		const rel = url.match(/uddg=([^&]+)/);
		if (rel) url = decodeURIComponent(rel[1]);
		titles.push({ url, title: stripHtml(m[2]).trim() });
	}
	const snips: string[] = [];
	while ((m = snipRe.exec(html)) !== null) {
		snips.push(stripHtml(m[1]).trim());
	}
	titles.forEach((t, i) => {
		out.push({ title: t.title, url: t.url, snippet: snips[i] ?? "" });
	});
	return out.slice(0, 10);
}

// Parse DuckDuckGo "lite" results (different markup: result-link / result-snippet).
function parseDdgLiteResults(html: string): SearchResult[] {
	const out: SearchResult[] = [];
	const linkRe = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	const snipRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
	const titles: Array<{ url: string; title: string }> = [];
	let m: RegExpExecArray | null;
	while ((m = linkRe.exec(html)) !== null) {
		const url = m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=([^&]+).*$/i, (_, u) => decodeURIComponent(u));
		titles.push({ url, title: stripHtml(m[2]).trim() });
	}
	const snips: string[] = [];
	while ((m = snipRe.exec(html)) !== null) {
		snips.push(stripHtml(m[1]).trim());
	}
	titles.forEach((t, i) => {
		out.push({ title: t.title, url: t.url, snippet: snips[i] ?? "" });
	});
	return out.slice(0, 10);
}

const SEARCH_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function runSearch(query: string): Promise<{ results: SearchResult[] } | { error: string }> {
	// Try DuckDuckGo Lite first (more reliable from datacenter IPs).
	const lite = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
		method: "GET",
		headers: { "User-Agent": SEARCH_UA },
	});
	if (lite.ok) {
		const html = await lite.text();
		const results = parseDdgLiteResults(html);
		if (results.length > 0) return { results };
	}
	// Fallback to the classic HTML endpoint.
	const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
		method: "GET",
		headers: { "User-Agent": SEARCH_UA },
	});
	if (htmlRes.ok) {
		const html = await htmlRes.text();
		const results = parseDdgResults(html);
		if (results.length > 0) return { results };
	}
	return { error: "No results returned by the search provider." };
}

// Gate: only allow GitHub domains to receive a supplied auth token so it can't
// be leaked to arbitrary hosts.
function authAllowed(host: string): boolean {
	return (
		host === "api.github.com" ||
		host === "raw.githubusercontent.com" ||
		host.endsWith(".raw.githubusercontent.com")
	);
}

export const onRequestPost = async ({ request }: { request: Request; env: Env }): Promise<Response> => {
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "Invalid JSON body." }, { status: 400 });
		}
		const b = body as {
			url?: string;
			search?: string;
			authorization?: string;
		};

		// MODE 1: web search
		if (typeof b.search === "string" && b.search.trim()) {
			const q = b.search.trim().slice(0, 200);
			const result = await runSearch(q);
			return Response.json({ ok: true, search: result }, { headers: { "Cache-Control": "no-store" } });
		}

		// MODE 2: fetch a URL
		const urlStr = typeof b.url === "string" ? b.url.trim() : "";
		if (!urlStr) return Response.json({ error: "Missing 'url' or 'search'." }, { status: 400 });
		const blocked = isBlocked(urlStr);
		if (blocked) return Response.json({ error: blocked }, { status: 403 });

		const upstreamHeaders: Record<string, string> = {
			"User-Agent": "CrackerBox/GodMode",
			Accept: "text/html,application/xhtml+xml,text/plain,application/json,*/*;q=0.8",
		};
		if (typeof b.authorization === "string" && b.authorization) {
			const host = new URL(urlStr).hostname.toLowerCase();
			if (authAllowed(host)) upstreamHeaders.Authorization = b.authorization;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 45_000);
		try {
			const res = await fetch(urlStr, {
				method: "GET",
				redirect: "follow",
				headers: upstreamHeaders,
				signal: controller.signal,
			});
			if (!res.ok) return Response.json({ error: `Upstream returned HTTP ${res.status}.` }, { status: 502 });
			const contentType = res.headers.get("content-type") ?? "";
			if (contentType.includes("json")) {
				const text = await res.text();
				return Response.json({ ok: true, content: text }, { headers: { "Cache-Control": "no-store" } });
			}
			const text = (await res.text()).slice(0, 900_000);
			const plain = contentType.includes("html") ? stripHtml(text) : text;
			return Response.json({ ok: true, content: plain.slice(0, 900_000) }, { headers: { "Cache-Control": "no-store" } });
		} finally {
			clearTimeout(timer);
		}
	} catch (e) {
		return Response.json({ error: e instanceof Error ? `Proxy error: ${e.message}` : "Proxy error." }, { status: 502 });
	}
};