import { getRuntimeEnv } from "../../../lib/runtime-env";

type Score = { fixtureId: string; homeGoals?: number; awayGoals?: number; isVoid?: boolean };
type SettlementPayload = { snapshotId?: string; actor?: string; scores?: Score[] };
type StoredSelection = {
  id: number;
  fixture_id: string;
  market_type: "result" | "goals";
  outcome: "home" | "draw" | "away" | "over" | "under";
  decimal_price: number;
  credits: number;
};

function authorised(request: Request) {
  const expected = getRuntimeEnv().TACTELO_ADMIN_KEY;
  if (!expected) return true;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return supplied === expected;
}

function selectionWon(selection: StoredSelection, score: Score) {
  const home = score.homeGoals ?? 0;
  const away = score.awayGoals ?? 0;
  if (selection.market_type === "goals") return selection.outcome === "over" ? home + away >= 3 : home + away <= 2;
  if (selection.outcome === "home") return home > away;
  if (selection.outcome === "away") return away > home;
  return home === away;
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const env = getRuntimeEnv();
  if (!env.DB) return Response.json({ error: "D1 storage is not configured" }, { status: 503 });
  let payload: SettlementPayload;
  try { payload = await request.json() as SettlementPayload; } catch { return Response.json({ error: "Invalid settlement payload" }, { status: 400 }); }
  const snapshotId = payload.snapshotId ?? "";
  const actor = payload.actor?.trim() || "admin";
  const scores = payload.scores ?? [];
  if (!snapshotId || !scores.length) return Response.json({ error: "Snapshot and at least one score are required" }, { status: 400 });
  if (scores.some((score) => !score.fixtureId || (!score.isVoid && (!Number.isInteger(score.homeGoals) || !Number.isInteger(score.awayGoals) || (score.homeGoals ?? -1) < 0 || (score.awayGoals ?? -1) < 0)))) {
    return Response.json({ error: "Every non-void fixture needs valid whole-number scores" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();
    await env.DB.batch(scores.map((score) => env.DB!.prepare(
      "INSERT OR REPLACE INTO results (fixture_id, home_goals, away_goals, source, entered_by, entered_at, is_void) VALUES (?, ?, ?, 'manual', ?, ?, ?)",
    ).bind(score.fixtureId, score.isVoid ? null : score.homeGoals, score.isVoid ? null : score.awayGoals, actor, now, score.isVoid ? 1 : 0)));

    const submissionResult = await env.DB.prepare("SELECT id, user_id FROM submissions WHERE snapshot_id = ?").bind(snapshotId).all<{ id: string; user_id: string }>();
    let settledEntries = 0;
    for (const submission of submissionResult.results) {
      const stored = await env.DB.prepare("SELECT id, fixture_id, market_type, outcome, decimal_price, credits FROM submission_selections WHERE submission_id = ? ORDER BY id")
        .bind(submission.id).all<StoredSelection>();
      const updates: D1PreparedStatement[] = [];
      const legResults: Array<"won" | "lost" | "void" | "pending"> = [];
      let gameweekPoints = 0;
      let winners = 0;
      let winningPriceTotal = 0;

      for (const selection of stored.results) {
        const score = scores.find((item) => item.fixtureId === selection.fixture_id);
        if (!score) { legResults.push("pending"); continue; }
        const result = score.isVoid ? "void" : selectionWon(selection, score) ? "won" : "lost";
        const points = result === "won" ? selection.credits * selection.decimal_price : result === "void" ? selection.credits : 0;
        if (result === "won") { winners += 1; winningPriceTotal += selection.decimal_price; }
        gameweekPoints += points;
        legResults.push(result);
        updates.push(env.DB.prepare("UPDATE submission_selections SET result = ?, points = ? WHERE id = ?").bind(result, Number(points.toFixed(2)), selection.id));
      }

      const combo = await env.DB.prepare("SELECT credits, original_combo_price FROM submission_combo WHERE submission_id = ?").bind(submission.id).first<{ credits: number; original_combo_price: number }>();
      if (combo && combo.credits > 0 && !legResults.includes("pending")) {
        const wonPrices = stored.results.filter((_: StoredSelection, index: number) => legResults[index] === "won").map((selection: StoredSelection) => selection.decimal_price);
        const settledPrice = wonPrices.length ? wonPrices.reduce((product: number, price: number) => product * price, 1) : 1;
        const comboResult = legResults.includes("lost") ? "lost" : wonPrices.length ? "won" : "void";
        const comboPoints = comboResult === "won" ? combo.credits * settledPrice : comboResult === "void" ? combo.credits : 0;
        gameweekPoints += comboPoints;
        updates.push(env.DB.prepare("UPDATE submission_combo SET settled_combo_price = ?, result = ?, points = ? WHERE submission_id = ?")
          .bind(Number(settledPrice.toFixed(2)), comboResult, Number(comboPoints.toFixed(2)), submission.id));
      }

      const prior = await env.DB.prepare("SELECT COALESCE(SUM(gameweek_points), 0) AS total FROM leaderboard_entries WHERE user_id = ? AND snapshot_id <> ?")
        .bind(submission.user_id, snapshotId).first<{ total: number }>();
      const average = winners ? winningPriceTotal / winners : 0;
      updates.push(
        env.DB.prepare("UPDATE submissions SET status = 'settled' WHERE id = ?").bind(submission.id),
        env.DB.prepare("INSERT INTO leaderboard_entries (user_id, snapshot_id, gameweek_points, total_points, winners, avg_winning_price) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, snapshot_id) DO UPDATE SET gameweek_points = excluded.gameweek_points, total_points = excluded.total_points, winners = excluded.winners, avg_winning_price = excluded.avg_winning_price")
          .bind(submission.user_id, snapshotId, Number(gameweekPoints.toFixed(2)), Number(((prior?.total ?? 0) + gameweekPoints).toFixed(2)), winners, Number(average.toFixed(3))),
      );
      await env.DB.batch(updates);
      settledEntries += 1;
    }

    await env.DB.batch([
      env.DB.prepare("UPDATE fixture_snapshots SET status = 'settled' WHERE id = ?").bind(snapshotId),
      env.DB.prepare("INSERT INTO audit_log (actor, action, entity, after, timestamp) VALUES (?, 'gameweek_settled', ?, ?, ?)").bind(actor, snapshotId, JSON.stringify({ scores: scores.length, entries: settledEntries }), now),
    ]);
    return Response.json({ ok: true, snapshotId, settledEntries, scores: scores.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Settlement failed" }, { status: 500 });
  }
}
