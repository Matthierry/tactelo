import { buildFeed, COLOUR_CSV_URL, FIXTURE_CSV_URL } from "../../lib/csv";
import { demoFixtureFeed } from "../../lib/demo-data";
import { getRuntimeEnv } from "../../lib/runtime-env";
import type { Fixture, FixtureFeed } from "../../lib/types";

export const dynamic = "force-dynamic";

async function activeSnapshot(): Promise<FixtureFeed | null> {
  const env = getRuntimeEnv();
  if (!env.DB) return null;
  try {
    const snapshot = await env.DB.prepare(
      "SELECT id, label, imported_at FROM fixture_snapshots WHERE status = 'active' ORDER BY imported_at DESC LIMIT 1",
    ).first<{ id: string; label: string; imported_at: string }>();
    if (!snapshot) return null;
    const result = await env.DB.prepare(
      "SELECT raw_row FROM fixtures WHERE snapshot_id = ? ORDER BY kickoff_iso, id",
    ).bind(snapshot.id).all<{ raw_row: string }>();
    const fixtures = result.results.flatMap((row: { raw_row: string }) => {
      try { return [JSON.parse(row.raw_row) as Fixture]; } catch { return []; }
    });
    if (!fixtures.length) return null;
    return {
      fixtures,
      snapshotId: snapshot.id,
      gameweekLabel: snapshot.label,
      importedAt: snapshot.imported_at,
      source: "google-sheet",
      missingColourTeams: [],
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const stored = await activeSnapshot();
  if (stored) return Response.json(stored, { headers: { "Cache-Control": "public, max-age=120" } });

  try {
    const [fixtureResponse, colourResponse] = await Promise.all([
      fetch(FIXTURE_CSV_URL, { cf: { cacheTtl: 300 }, signal: AbortSignal.timeout(6500) }),
      fetch(COLOUR_CSV_URL, { cf: { cacheTtl: 3600 }, signal: AbortSignal.timeout(6500) }),
    ]);
    if (!fixtureResponse.ok || !colourResponse.ok) throw new Error("Published Sheet is unavailable");
    const feed = buildFeed(await fixtureResponse.text(), await colourResponse.text());
    return Response.json(feed, { headers: { "Cache-Control": "public, max-age=120" } });
  } catch {
    return Response.json(demoFixtureFeed, {
      headers: { "Cache-Control": "public, max-age=60", "X-Tactelo-Feed": "demo-fallback" },
    });
  }
}
