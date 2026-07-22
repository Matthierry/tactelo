import { getRuntimeEnv } from "../../../lib/runtime-env";
import { authorisedAdminRequest } from "../../../lib/admin-auth";

type ReversalPayload = {
  snapshotId?: string;
  confirmation?: string;
};

export async function POST(request: Request) {
  if (!(await authorisedAdminRequest(request))) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const env = getRuntimeEnv();
  if (!env.DB) {
    return Response.json({ error: "D1 storage is not configured" }, { status: 503 });
  }

  let payload: ReversalPayload;
  try {
    payload = await request.json() as ReversalPayload;
  } catch {
    return Response.json({ error: "Invalid reversal payload" }, { status: 400 });
  }

  const snapshotId = payload.snapshotId?.trim() ?? "";
  if (!snapshotId || payload.confirmation !== "REVERSE") {
    return Response.json({ error: "Type REVERSE exactly to confirm this action" }, { status: 400 });
  }

  try {
    const snapshot = await env.DB.prepare(
      "SELECT id, label, status FROM fixture_snapshots WHERE id = ? LIMIT 1",
    ).bind(snapshotId).first<{ id: string; label: string; status: string }>();

    if (!snapshot) {
      return Response.json({ error: "Gameweek snapshot was not found" }, { status: 404 });
    }
    if (snapshot.status !== "settled") {
      return Response.json({ error: "Only a settled gameweek can be reversed" }, { status: 409 });
    }

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM submissions WHERE snapshot_id = ?",
    ).bind(snapshotId).first<{ total: number }>();
    const submissions = Number(count?.total ?? 0);
    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(
        "UPDATE submission_selections SET result = 'pending', points = 0 WHERE submission_id IN (SELECT id FROM submissions WHERE snapshot_id = ?)",
      ).bind(snapshotId),
      env.DB.prepare(
        "UPDATE submission_combo SET settled_combo_price = NULL, result = 'pending', points = 0 WHERE submission_id IN (SELECT id FROM submissions WHERE snapshot_id = ?)",
      ).bind(snapshotId),
      env.DB.prepare("DELETE FROM leaderboard_entries WHERE snapshot_id = ?").bind(snapshotId),
      env.DB.prepare("UPDATE submissions SET status = 'submitted' WHERE snapshot_id = ?").bind(snapshotId),
      env.DB.prepare("UPDATE fixture_snapshots SET status = 'active' WHERE id = ?").bind(snapshotId),
      env.DB.prepare(
        "INSERT INTO audit_log (actor, action, entity, before, after, timestamp) VALUES ('admin', 'gameweek_settlement_reversed', ?, ?, ?, ?)",
      ).bind(
        snapshotId,
        JSON.stringify({ status: "settled" }),
        JSON.stringify({ status: "active", submissions, resultsPreserved: true }),
        now,
      ),
    ]);

    return Response.json({
      ok: true,
      snapshotId,
      gameweekLabel: snapshot.label,
      submissions,
      resultsPreserved: true,
    });
  } catch (error) {
    console.error("Settlement reversal failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Database update failed",
    });
    return Response.json({ error: "Settlement reversal failed" }, { status: 500 });
  }
}
