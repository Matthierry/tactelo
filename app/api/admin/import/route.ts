import { buildFeed, COLOUR_CSV_URL, FIXTURE_CSV_URL } from "../../../lib/csv";
import { getRuntimeEnv } from "../../../lib/runtime-env";
import { authorisedAdminRequest } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorisedAdminRequest(request))) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const env = getRuntimeEnv();
  if (!env.DB) return Response.json({ error: "D1 storage is not configured" }, { status: 503 });
  const db = env.DB;
  try {
    const [fixtureResponse, colourResponse] = await Promise.all([fetch(FIXTURE_CSV_URL), fetch(COLOUR_CSV_URL)]);
    if (!fixtureResponse.ok || !colourResponse.ok) throw new Error("Google Sheet feed unavailable");
    const fixtureCsv = await fixtureResponse.text();
    const feed = buildFeed(fixtureCsv, await colourResponse.text());
    const confirm = new URL(request.url).searchParams.get("confirm") === "true";
    const status = confirm ? "active" : "staged";
    const statements = [
      db.prepare("INSERT INTO fixture_snapshots (id, label, source_url, imported_at, import_hash, status, raw_csv) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, source_url = excluded.source_url, imported_at = excluded.imported_at, import_hash = excluded.import_hash, status = excluded.status, raw_csv = excluded.raw_csv").bind(feed.snapshotId, feed.gameweekLabel, FIXTURE_CSV_URL, feed.importedAt, feed.snapshotId, status, fixtureCsv),
      ...feed.fixtures.map((fixture) => db.prepare("INSERT INTO fixtures (id, snapshot_id, competition, kickoff_iso, home_team, away_team, status, raw_row) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?) ON CONFLICT(id) DO UPDATE SET snapshot_id = excluded.snapshot_id, competition = excluded.competition, kickoff_iso = excluded.kickoff_iso, home_team = excluded.home_team, away_team = excluded.away_team, status = excluded.status, raw_row = excluded.raw_row").bind(fixture.id, feed.snapshotId, fixture.competition, fixture.kickoffIso, fixture.homeTeam, fixture.awayTeam, JSON.stringify(fixture))),
      db.prepare("INSERT INTO audit_log (actor, action, entity, after, timestamp) VALUES ('scheduled-import', 'snapshot_imported', ?, ?, ?)").bind(feed.snapshotId, JSON.stringify({ fixtures: feed.fixtures.length, status }), feed.importedAt),
    ];
    if (confirm) statements.unshift(db.prepare("UPDATE fixture_snapshots SET status = 'hidden' WHERE status = 'active'"));
    await db.batch(statements);
    return Response.json({ ok: true, snapshotId: feed.snapshotId, fixtures: feed.fixtures.length, status, missingColourTeams: feed.missingColourTeams });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 502 });
  }
}
