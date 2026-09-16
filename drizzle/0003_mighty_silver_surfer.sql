CREATE TABLE `access_devices` (
	`device_token_hash` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`banned_at` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_access_devices_banned_at` ON `access_devices` (`banned_at`);--> statement-breakpoint
CREATE TABLE `access_login_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`device_hash` text NOT NULL,
	`password_hash_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_access_login_challenges_expires_at` ON `access_login_challenges` (`expires_at`);--> statement-breakpoint
ALTER TABLE `access_sessions` ADD `device_hash` text DEFAULT '' NOT NULL;