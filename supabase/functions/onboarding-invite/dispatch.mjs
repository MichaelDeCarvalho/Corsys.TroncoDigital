const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function dispatch(request, { authorize, claim, invite, finish }) {
  const reply = (status, outcome) =>
    Response.json({ outcome }, { status, headers: { "Cache-Control": "no-store" } });

  if (request.method !== "POST") return reply(405, "method_not_allowed");
  const token = request.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) return reply(401, "authentication_required");

  try {
    const actor = await authorize(token);
    if (!actor) return reply(403, "forbidden");

    const runId = new URL(request.url).searchParams.get("run_id");
    if (!runId || !runIdPattern.test(runId)) return reply(400, "invalid_run_id");

    const job = await claim(runId, actor);
    if (!job) return reply(409, "not_dispatchable");

    let invitedUserId = null;
    try {
      invitedUserId = await invite(job.recipient);
    } catch {
      // A transport failure can follow a successful send.
    }

    try {
      if (await finish(job.job_id, actor, invitedUserId) && invitedUserId) {
        return reply(200, "auth_accepted");
      }
    } catch {
      // The durable reservation survives loss of the response or final write.
    }
    return reply(502, "reconciliation_required");
  } catch {
    return reply(503, "dispatch_unavailable");
  }
}
