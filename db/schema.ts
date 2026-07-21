import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const fixtureSnapshots = sqliteTable("fixture_snapshots", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  sourceUrl: text("source_url").notNull(),
  importedAt: text("imported_at").notNull(),
  importHash: text("import_hash").notNull(),
  status: text("status", { enum: ["staged", "active", "hidden", "settled"] }).notNull().default("staged"),
  manuallyConfirmedBy: text("manually_confirmed_by"),
  rawCsv: text("raw_csv").notNull(),
}, (table) => [index("fixture_snapshots_status_idx").on(table.status, table.importedAt)]);

export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").notNull().references(() => fixtureSnapshots.id),
  competition: text("competition").notNull(),
  kickoffIso: text("kickoff_iso").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  status: text("status", { enum: ["scheduled", "finished", "void"] }).notNull().default("scheduled"),
  rawRow: text("raw_row").notNull(),
}, (table) => [index("fixtures_snapshot_idx").on(table.snapshotId), index("fixtures_kickoff_idx").on(table.kickoffIso)]);

export const teamColours = sqliteTable("team_colours", {
  teamName: text("team_name").primaryKey(),
  primaryColour: text("primary_colour").notNull(),
  secondaryColour: text("secondary_colour").notNull(),
  importedAt: text("imported_at").notNull(),
});

export const markets = sqliteTable("markets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id),
  marketType: text("market_type", { enum: ["result", "goals"] }).notNull(),
  outcome: text("outcome").notNull(),
  decimalPrice: real("decimal_price").notNull(),
  displayReturn: text("display_return").notNull(),
}, (table) => [uniqueIndex("markets_fixture_outcome_unique").on(table.fixtureId, table.outcome)]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  snapshotId: text("snapshot_id").notNull().references(() => fixtureSnapshots.id),
  submittedAt: text("submitted_at").notNull(),
  status: text("status", { enum: ["submitted", "settled", "void"] }).notNull().default("submitted"),
}, (table) => [uniqueIndex("submission_user_snapshot_unique").on(table.userId, table.snapshotId)]);

export const submissionSelections = sqliteTable("submission_selections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: text("submission_id").notNull().references(() => submissions.id),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id),
  marketType: text("market_type", { enum: ["result", "goals"] }).notNull(),
  outcome: text("outcome").notNull(),
  decimalPrice: real("decimal_price").notNull(),
  credits: integer("credits").notNull(),
  result: text("result", { enum: ["pending", "won", "lost", "void"] }).notNull().default("pending"),
  points: real("points").notNull().default(0),
}, (table) => [index("submission_selections_submission_idx").on(table.submissionId)]);

export const submissionCombos = sqliteTable("submission_combo", {
  submissionId: text("submission_id").primaryKey().references(() => submissions.id),
  credits: integer("credits").notNull(),
  originalComboPrice: real("original_combo_price").notNull(),
  settledComboPrice: real("settled_combo_price"),
  result: text("result", { enum: ["pending", "won", "lost", "void"] }).notNull().default("pending"),
  points: real("points").notNull().default(0),
});

export const results = sqliteTable("results", {
  fixtureId: text("fixture_id").primaryKey().references(() => fixtures.id),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  source: text("source").notNull(),
  enteredBy: text("entered_by").notNull(),
  enteredAt: text("entered_at").notNull(),
  isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
});

export const leaderboardEntries = sqliteTable("leaderboard_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  snapshotId: text("snapshot_id").notNull().references(() => fixtureSnapshots.id),
  gameweekPoints: real("gameweek_points").notNull().default(0),
  totalPoints: real("total_points").notNull().default(0),
  winners: integer("winners").notNull().default(0),
  averageWinningPrice: real("avg_winning_price").notNull().default(0),
}, (table) => [uniqueIndex("leaderboard_user_snapshot_unique").on(table.userId, table.snapshotId)]);

export const analyticsEvents = sqliteTable("analytics_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventName: text("event_name").notNull(),
  userId: text("user_id"),
  snapshotId: text("snapshot_id"),
  detail: text("detail").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("analytics_event_name_idx").on(table.eventName, table.occurredAt)]);

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  before: text("before"),
  after: text("after"),
  reason: text("reason"),
  timestamp: text("timestamp").notNull(),
}, (table) => [index("audit_log_timestamp_idx").on(table.timestamp)]);
