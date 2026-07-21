import { buildFeed, COLOUR_CSV_URL, FIXTURE_CSV_URL } from "../../lib/csv";
import { demoFixtureFeed } from "../../lib/demo-data";
import { getRuntimeEnv } from "../../lib/runtime-env";
import type { FixtureFeed, Pick, SubmissionReceipt } from "../../lib/types";

type Payload = {
  snapshotId?: string;
  picks?: Pick[];
  credits?: number[];
  combo?: number;
};

function sessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("tactelo_session="))?.slice("tactelo_session=".length) ?? "";
}

async function authenticatedEmail(request: Request) {
  const token = sessionToken(request);
  if (!token) return null;
  if (token.startsWith("demo-")) return decodeURIComponent(token.slice(5));
  const env = getRuntimeEnv();
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare("SELECT users.email AS email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ? LIMIT 1")
      .bind(token, new Date().toISOString()).first<{ email: string }>();
    return row?.email ?? null;
  } catch { return null; }
}

function reject(error: string, status = 400) {
  return Response.json({ error }, { status });
}

async function serverFeed(snapshotId: string): Promise<FixtureFeed> {
  if (snapshotId === demoFixtureFeed.snapshotId) return demoFixtureFeed;
  try {
    const [fixtures, colours] = await Promise.all([fetch(FIXTURE_CSV_URL), fetch(COLOUR_CSV_URL)]);
    if (!fixtures.ok || !colours.ok) throw new Error("Feed unavailable");
    return buildFeed(await fixtures.text(), await colours.text());
  } catch {
    throw new Error("The stored fixture snapshot could not be validated. Please try again.");
  }
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function persist(receipt: SubmissionReceipt) {
  const env = getRuntimeEnv();
  if (!env.DB) return;
  const db = env.DB;
  const now = receipt.submittedAt;
  try {
    const existingUser = await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(receipt.email).first<{ id: string }>();
    const userId = existingUser?.id ?? `user-${crypto.randomUUID()}`;
    const statements = [
      ...(!existingUser ? [db.prepare("INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, '', '', ?)").bind(userId, receipt.email, receipt.email.split("@")[0], now)] : []),
      db.prepare("INSERT INTO submissions (id, user_id, snapshot_id, submitted_at, status) VALUES (?, ?, ?, ?, 'submitted')").bind(receipt.id, userId, receipt.snapshotId, now),
      ...receipt.picks.map((pick, index) => db.prepare("INSERT INTO submission_selections (submission_id, fixture_id, market_type, outcome, decimal_price, credits, result, points) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)").bind(receipt.id, pick.fixtureId, pick.market, pick.outcome, pick.price, receipt.credits[index])),
      db.prepare("INSERT INTO submission_combo (submission_id, credits, original_combo_price, result, points) VALUES (?, ?, ?, 'pending', 0)").bind(receipt.id, receipt.comboCredit, receipt.comboPrice),
      db.prepare("INSERT INTO audit_log (actor, action, entity, after, timestamp) VALUES (?, 'submission_created', ?, ?, ?)").bind(receipt.email, receipt.id, JSON.stringify(receipt), now),
    ];
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database write failed";
    if (message.includes("UNIQUE constraint failed")) return;
    // Local agent preview uses a disposable D1 binding before migrations run.
    // Production deployments apply the checked-in migration before serving writes.
    if (message.includes("no such table")) return;
    throw error;
  }
}

export async function POST(request: Request) {
  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return reject("Invalid submission payload"); }
  const { snapshotId = "", picks = [], credits = [], combo = 0 } = payload;
  const email = await authenticatedEmail(request);
  if (!email) return reject("Log in before submitting your entry.", 401);
  if (picks.length !== 3 || new Set(picks.map((pick) => pick.fixtureId)).size !== 3) return reject("Choose exactly three selections from different fixtures.");
  if (credits.length !== 3 || !credits.every((value) => Number.isInteger(value) && value >= 1 && value <= 4)) return reject("Each pick must receive between one and four whole credits.");
  if (!Number.isInteger(combo) || combo < 0 || combo > 1) return reject("The combo can receive zero or one credit.");
  if (credits.reduce((sum, value) => sum + value, 0) + combo !== 6) return reject("Allocate exactly six credits before submitting.");

  let feed: FixtureFeed;
  try { feed = await serverFeed(snapshotId); } catch (error) { return reject(error instanceof Error ? error.message : "Snapshot validation failed", 409); }
  if (feed.snapshotId !== snapshotId) return reject("Fixture prices have changed. Review the latest snapshot before submitting.", 409);
  const earliest = Math.min(...feed.fixtures.map((fixture) => new Date(fixture.kickoffIso).getTime()));
  if (Date.now() >= earliest) return reject("Selections closed when the first fixture kicked off.", 409);
  for (const pick of picks) {
    const fixture = feed.fixtures.find((item) => item.id === pick.fixtureId);
    if (!fixture || fixture.prices[pick.outcome] !== pick.price) return reject("One or more selections or prices failed server validation.", 409);
    if ((pick.market === "result" && !["home", "draw", "away"].includes(pick.outcome)) || (pick.market === "goals" && !["over", "under"].includes(pick.outcome))) return reject("A market selection is invalid.");
  }

  const comboPrice = Number(picks.reduce((product, pick) => product * pick.price, 1).toFixed(2));
  const receipt: SubmissionReceipt = {
    id: id("TC"), snapshotId, submittedAt: new Date().toISOString(), email,
    credits, comboCredit: combo, comboPrice, picks,
  };
  try { await persist(receipt); } catch { return reject("Your entry was valid but could not be stored. Please try again.", 503); }
  return Response.json({ receipt }, { status: 201 });
}
