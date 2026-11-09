import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatch } from "./dispatch.mjs";

const runId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const request = (run = runId, token = "Bearer test") =>
  new Request("http://localhost/onboarding-invite?run_id=" + run, {
    method: "POST",
    headers: { Authorization: token },
  });

test("unauthorized or malformed requests never reach the queue", async () => {
  const deps = { authorize: async () => null, claim: () => assert.fail("unexpected claim") };
  assert.equal((await dispatch(request(runId, ""), deps)).status, 401);
  assert.equal((await dispatch(request(), deps)).status, 403);
  deps.authorize = async () => "master";
  assert.equal((await dispatch(request("invalid"), deps)).status, 400);
});

test("overlapping requests send once when the queue grants one claim", async () => {
  let claimed = false;
  let sent = 0;
  const deps = {
    authorize: async () => "master",
    claim: async (id, actor) => {
      assert.equal(id, runId);
      assert.equal(actor, "master");
      if (claimed) return null;
      claimed = true;
      return { job_id: "job", recipient: "invite@example.test" };
    },
    invite: async (email) => {
      assert.equal(email, "invite@example.test");
      sent++;
      return true;
    },
    finish: async (...args) => {
      assert.deepEqual(args, ["job", "master", true]);
      return true;
    },
  };
  const results = await Promise.all([dispatch(request(), deps), dispatch(request(), deps)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(sent, 1);
  assert.deepEqual(await results.find((result) => result.ok).json(), { outcome: "auth_accepted" });
});

test("ambiguous transport and finalization failures remain reserved", async () => {
  for (const transportThrows of [true, false]) {
    let claimed = false;
    let sent = 0;
    const deps = {
      authorize: async () => "master",
      claim: async () => {
        if (claimed) return null;
        claimed = true;
        return { job_id: "job", recipient: "invite@example.test" };
      },
      invite: async () => {
        sent++;
        if (transportThrows) throw new Error("private provider response");
        return true;
      },
      finish: async (_job, _actor, accepted) => {
        assert.equal(accepted, !transportThrows);
        if (!transportThrows) throw new Error("lost finalization");
        return true;
      },
    };
    const first = await dispatch(request(), deps);
    assert.equal(first.status, 502);
    assert.deepEqual(await first.json(), { outcome: "reconciliation_required" });
    assert.equal((await dispatch(request(), deps)).status, 409);
    assert.equal(sent, 1);
  }
});
