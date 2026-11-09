import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { dispatch } from "./dispatch.mjs";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase runtime configuration");

const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
const server = createClient(url, serviceKey, { auth });

const configuredOrigin = Deno.env.get("ONBOARDING_APP_ORIGIN");
const appOrigin = configuredOrigin ? new URL(configuredOrigin) : null;
if (appOrigin && (appOrigin.protocol !== "https:" || appOrigin.href !== appOrigin.origin + "/")) {
  throw new Error("Invalid onboarding app origin");
}

Deno.serve((request) => !appOrigin
  ? Response.json({ outcome: "dispatch_unavailable" }, { status: 503 })
  : dispatch(request, {
  async authorize(authorization: string) {
    const caller = createClient(url, anonKey, {
      auth,
      global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await caller.rpc("authorize_onboarding_invite_dispatch");
    return error ? null : data;
  },
  async claim(runId: string, actor: string) {
    const { data, error } = await server.rpc("claim_onboarding_invite", {
      p_run_id: runId,
      p_actor: actor,
    }).maybeSingle();
    if (error) throw error;
    return data;
  },
  async invite(email: string, runId: string) {
    if (!appOrigin) throw new Error("Missing onboarding app origin");
    const redirect = new URL("/onboarding/accept", appOrigin);
    redirect.searchParams.set("run_id", runId);
    const { data, error } = await server.auth.admin.inviteUserByEmail(email, { redirectTo: redirect.href });
    return error ? null : data.user?.id ?? null;
  },
  async finish(jobId: string, actor: string, invitedUserId: string | null) {
    const { data, error } = await server.rpc("finish_onboarding_invite_with_identity", {
      p_job_id: jobId,
      p_actor: actor,
      p_invited_user_id: invitedUserId,
    });
    if (error) throw error;
    return data === true;
  },
}));
