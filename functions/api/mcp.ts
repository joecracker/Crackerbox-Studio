// Cloudflare Pages Function — MCP proxy for Home Assistant (Nabu Casa).
//
// Cracker Box runs in the browser and cannot reach Home Assistant directly:
// HA's local/Nabu Casa endpoint doesn't send CORS headers, so the browser
// blocks the request. This function relays Streamable-HTTP MCP traffic from
// the browser to the user's Home Assistant instance, solving the CORS wall
// and letting the chat actually use HA tools.

interface Env {}

// The browser sends the real MCP endpoint URL + the HA long-lived token in
// headers; we forward them to Home Assistant and pipe the response back
// (including the Mcp-Session-Id header that MCP requires for stateful calls).
export const onRequestPost = async ({
  request,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  try {
    const target = request.headers.get("x-mcp-target");
    if (!target) {
      return Response.json({ error: "Missing x-mcp-target header" }, { status: 400 });
    }

    const allowed = /^https:\/\/[a-z0-9-]+\.(ui\.nabu\.casa|nabu\.casa)\//i;
    if (!allowed.test(target)) {
      return Response.json(
        { error: "Only nabu.casa MCP endpoints are allowed through this proxy." },
        { status: 403 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: request.headers.get("Accept") ?? "application/json, text/event-stream",
      "Mcp-Session-Id": request.headers.get("Mcp-Session-Id") ?? "",
    };
    const auth = request.headers.get("Authorization");
    if (auth) headers.Authorization = auth;

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: request.body,
      redirect: "follow",
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
    const sessionId = upstream.headers.get("Mcp-Session-Id");
    if (sessionId) responseHeaders.set("Mcp-Session-Id", sessionId);
    // Allow the browser to read these response headers cross-origin (same-origin here anyway).
    responseHeaders.set("Access-Control-Expose-Headers", "Mcp-Session-Id");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "MCP proxy failed";
    return Response.json({ error: message }, { status: 502 });
  }
};

// MCP also uses GET for the SSE notification channel on some transports.
export const onRequestGet = async ({
  request,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  return onRequestPost({ request, env: {} });
};