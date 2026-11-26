import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase runtime configuration");
const configuredOrigin = Deno.env.get("PORTABILITY_APP_ORIGIN") ?? Deno.env.get("ONBOARDING_APP_ORIGIN");
const appOrigin = configuredOrigin ? new URL(configuredOrigin) : null;
if (appOrigin && (appOrigin.protocol !== "https:" || appOrigin.href !== appOrigin.origin + "/")) {
  throw new Error("Invalid portability app origin");
}
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const server = createClient(url, serviceKey, { auth });
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const bucket = "tenant-documents";
const maxBytes = 16 * 1024 * 1024;

Deno.serve(async (request) => {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" });
  const fail = (status: number) => Response.json({ error: "attachment_unavailable" }, { status, headers });
  const origin = request.headers.get("Origin");
  if (!appOrigin || (origin && origin !== appOrigin.origin)) return fail(403);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return fail(405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return fail(401);

  const input = await request.json().catch(() => null);
  const ids = [input?.p_organization_id, input?.p_export_id, input?.p_document_id];
  if (ids.some((id) => typeof id !== "string" || !uuid.test(id))) return fail(400);
  const [orgId, exportId, documentId] = ids;

  const caller = createClient(url, anonKey, { auth, global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await caller.auth.getUser(authorization.slice(7));
  if (authError || !user) return fail(401);
  const { data: metadata, error: permissionError } = await caller.rpc("authorize_tenant_portability_attachment_download", {
    p_organization_id: orgId, p_export_id: exportId, p_document_id: documentId,
  });
  if (permissionError || !metadata || metadata.organization_id !== orgId ||
      metadata.export_id !== exportId || metadata.document_id !== documentId ||
      metadata.storage_bucket !== bucket || typeof metadata.storage_object_key !== "string" ||
      !metadata.storage_object_key.startsWith(orgId + "/") ||
      !/^[0-9a-f]{64}$/i.test(metadata.sha256)) return fail(403);

  const audit = async (outcome: string) => {
    const { error } = await server.from("audit_logs").insert({
      organization_id: orgId, actor_user_id: user.id, action: "privacy.portability_attachment_download_result",
      entity_type: "documents", entity_id: documentId, after_data: { export_id: exportId, outcome },
    });
    return !error;
  };
  const bytesExpected = Number(metadata.size_bytes);
  if (!Number.isSafeInteger(bytesExpected) || bytesExpected < 0 || bytesExpected > maxBytes) {
    await audit("size_denied");
    return fail(413);
  }
  const { data: blob, error: storageError } = await server.storage.from(bucket).download(metadata.storage_object_key);
  if (storageError || !blob) {
    await audit("object_unavailable");
    return fail(404);
  }
  if (blob.size !== bytesExpected) {
    await audit("size_mismatch");
    return fail(409);
  }
  const bytes = await blob.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) =>
    byte.toString(16).padStart(2, "0")).join("");
  if (hash !== metadata.sha256.toLowerCase() || !(Date.parse(metadata.expires_at) > Date.now())) {
    await audit("integrity_or_expiry_denied");
    return fail(409);
  }
  if (!await audit("verified_binary_returned")) return fail(503);
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Disposition", "attachment");
  return new Response(bytes, { headers });
});
