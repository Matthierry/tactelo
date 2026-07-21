CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_name` text NOT NULL,
	`user_id` text,
	`snapshot_id` text,
	`detail` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_event_name_idx` ON `analytics_events` (`event_name`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`before` text,
	`after` text,
	`reason` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE TABLE `fixture_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`source_url` text NOT NULL,
	`imported_at` text NOT NULL,
	`import_hash` text NOT NULL,
	`status` text DEFAULT 'staged' NOT NULL,
	`manually_confirmed_by` text,
	`raw_csv` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fixture_snapshots_status_idx` ON `fixture_snapshots` (`status`,`imported_at`);--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`competition` text NOT NULL,
	`kickoff_iso` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`raw_row` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `fixture_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fixtures_snapshot_idx` ON `fixtures` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `fixtures_kickoff_idx` ON `fixtures` (`kickoff_iso`);--> statement-breakpoint
CREATE TABLE `leaderboard_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`gameweek_points` real DEFAULT 0 NOT NULL,
	`total_points` real DEFAULT 0 NOT NULL,
	`winners` integer DEFAULT 0 NOT NULL,
	`avg_winning_price` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `fixture_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_user_snapshot_unique` ON `leaderboard_entries` (`user_id`,`snapshot_id`);--> statement-breakpoint
CREATE TABLE `markets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixture_id` text NOT NULL,
	`market_type` text NOT NULL,
	`outcome` text NOT NULL,
	`decimal_price` real NOT NULL,
	`display_return` text NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_fixture_outcome_unique` ON `markets` (`fixture_id`,`outcome`);--> statement-breakpoint
CREATE TABLE `results` (
	`fixture_id` text PRIMARY KEY NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`source` text NOT NULL,
	`entered_by` text NOT NULL,
	`entered_at` text NOT NULL,
	`is_void` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submission_combo` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`credits` integer NOT NULL,
	`original_combo_price` real NOT NULL,
	`settled_combo_price` real,
	`result` text DEFAULT 'pending' NOT NULL,
	`points` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submission_selections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` text NOT NULL,
	`fixture_id` text NOT NULL,
	`market_type` text NOT NULL,
	`outcome` text NOT NULL,
	`decimal_price` real NOT NULL,
	`credits` integer NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`points` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submission_selections_submission_idx` ON `submission_selections` (`submission_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`submitted_at` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `fixture_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_user_snapshot_unique` ON `submissions` (`user_id`,`snapshot_id`);--> statement-breakpoint
CREATE TABLE `team_colours` (
	`team_name` text PRIMARY KEY NOT NULL,
	`primary_colour` text NOT NULL,
	`secondary_colour` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);