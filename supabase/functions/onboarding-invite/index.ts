import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { dispatch } from "./dispatch.mjs";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase runtime configuration");

const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
const server = createClient(url, serviceKey, { auth });

Deno.serve((request) => dispatch(request, {
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
  async invite(email: string) {
    const { data, error } = await server.auth.admin.inviteUserByEmail(email);
    return !error && Boolean(data.user?.id);
  },
  async finish(jobId: string, actor: string, accepted: boolean) {
    const { data, error } = await server.rpc("finish_onboarding_invite", {
      p_job_id: jobId,
      p_actor: actor,
      p_accepted: accepted,
    });
    if (error) throw error;
    return data === true;
  },
}));
