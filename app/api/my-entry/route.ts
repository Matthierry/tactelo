import { getRuntimeEnv } from "../../lib/runtime-env";

function sessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("tactelo_session="))?.slice("tactelo_session=".length) ?? "";
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = sessionToken(request);
  if (!token) return Response.json({ error: "Log in to view your picks." }, { status: 401 });

  const env = getRuntimeEnv();
  if (!env.DB) return Response.json({ error: "Entry storage is not configured." }, { status: 503 });

  const receiptId = new URL(request.url).searchParams.get("receiptId")?.trim() ?? "";
  const snapshotId = new URL(request.url).searchParams.get("snapshotId")?.trim() ?? "";
  if (!receiptId) return Response.json({ error: "A receipt is required." }, { status: 400 });

  try {
    let submission = await env.DB.prepare(
      `SELECT submissions.id, submissions.status
       FROM submissions
       JOIN sessions ON sessions.user_id = submissions.user_id
       WHERE submissions.id = ? AND sessions.token = ? AND sessions.expires_at > ?
       LIMIT 1`,
    ).bind(receiptId, token, new Date().toISOString()).first<{ id: string; status: string }>();

    // A repeated submission for the same gameweek can leave an old browser receipt
    // after D1 preserves the user's original entry via the user/snapshot unique key.
    // Resolve that stored entry through the authenticated session and snapshot only.
    if (!submission && snapshotId) {
      submission = await env.DB.prepare(
        `SELECT submissions.id, submissions.status
         FROM submissions
         JOIN sessions ON sessions.user_id = submissions.user_id
         WHERE submissions.snapshot_id = ? AND sessions.token = ? AND sessions.expires_at > ?
         ORDER BY submissions.submitted_at DESC
         LIMIT 1`,
      ).bind(snapshotId, token, new Date().toISOString()).first<{ id: string; status: string }>();
    }

    if (!submission) return Response.json({ error: "Entry not found." }, { status: 404 });

    const storedReceiptId = submission.id;

    const selections = await env.DB.prepare(
      "SELECT fixture_id AS fixtureId, result, points FROM submission_selections WHERE submission_id = ? ORDER BY id",
    ).bind(storedReceiptId).all<{ fixtureId: string; result: "pending" | "won" | "lost" | "void"; points: number }>();
    const combo = await env.DB.prepare(
      "SELECT result, points, settled_combo_price AS settledPrice FROM submission_combo WHERE submission_id = ? LIMIT 1",
    ).bind(storedReceiptId).first<{ result: "pending" | "won" | "lost" | "void"; points: number; settledPrice: number | null }>();

    return Response.json({
      receiptId: storedReceiptId,
      status: submission.status,
      selections: selections.results,
      combo: combo ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("My picks lookup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Database lookup failed",
    });
    return Response.json({ error: "Your latest results could not be loaded." }, { status: 500 });
  }
}
