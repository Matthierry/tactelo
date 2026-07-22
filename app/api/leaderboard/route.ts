import { getRuntimeEnv } from "../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getRuntimeEnv();
  const scope = new URL(request.url).searchParams.get("scope") === "gameweek" ? "gameweek" : "overall";
  if (!env.DB) return Response.json({ error: "Leaderboard storage is not configured" }, { status: 503 });
  try {
    const sql = scope === "gameweek"
      ? "SELECT users.display_name AS name, leaderboard_entries.gameweek_points AS points, leaderboard_entries.winners AS winners, leaderboard_entries.avg_winning_price AS average FROM leaderboard_entries JOIN users ON users.id = leaderboard_entries.user_id WHERE leaderboard_entries.snapshot_id = (SELECT id FROM fixture_snapshots WHERE status IN ('active','settled') ORDER BY imported_at DESC LIMIT 1) ORDER BY points DESC, winners DESC, average DESC"
      : "SELECT users.display_name AS name, MAX(leaderboard_entries.total_points) AS points, SUM(leaderboard_entries.winners) AS winners, CASE WHEN SUM(leaderboard_entries.winners) > 0 THEN SUM(leaderboard_entries.avg_winning_price * leaderboard_entries.winners) / SUM(leaderboard_entries.winners) ELSE 0 END AS average FROM leaderboard_entries JOIN users ON users.id = leaderboard_entries.user_id GROUP BY users.id, users.display_name ORDER BY points DESC, winners DESC, average DESC";
    const result = await env.DB.prepare(sql).all<{ name: string; points: number; winners: number; average: number }>();
    return Response.json({ scope, rows: result.results, source: "database" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Leaderboard lookup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Database lookup failed",
    });
    return Response.json({ error: "The latest leaderboard could not be loaded" }, { status: 500 });
  }
}
