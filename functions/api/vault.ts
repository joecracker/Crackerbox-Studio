// Cloudflare Pages Function — cloud vault sync for Cracker Box.
//
// Stores the user's ENCRYPTED vault blob (already AES-GCM sealed client-side with
// the user's passphrase) in a KV namespace, keyed by a passphrase-derived hash.
// The server never sees a plaintext token or the passphrase itself.
//
//   GET /api/vault?key=<hex>   -> { ok: true, vault: {...} } or { ok: false }
//   PUT /api/vault?key=<hex>   -> { ok: true }  (body: the encrypted vault state)
//
// Requires a KV namespace binding named VAULT_KV on the Pages project.

interface Env {
  VAULT_KV: KVNamespace;
}

function badKey(): Response {
  return Response.json({ ok: false, error: "Missing or invalid vault key." }, { status: 400 });
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(key)) return badKey();
  try {
    const raw = await env.VAULT_KV.get(key);
    if (raw === null) return Response.json({ ok: true, vault: null });
    return Response.json({ ok: true, vault: JSON.parse(raw) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "KV read failed." }, { status: 502 });
  }
};

export const onRequestPut = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(key)) return badKey();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid vault payload." }, { status: 400 });
  }
  try {
    await env.VAULT_KV.put(key, JSON.stringify(body));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "KV write failed." }, { status: 502 });
  }
};