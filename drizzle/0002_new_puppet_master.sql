CREATE TABLE `access_login_attempts` (
	`subject_hash` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`password_hash_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_access_sessions_expires_at` ON `access_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `document_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'revoked' NOT NULL,
	`revoked_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_verification_tokens_token` ON `document_verification_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_document_verification_tokens_document` ON `document_verification_tokens` (`document_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `order_documents` ADD `logo_asset_id` text DEFAULT 'advanced-pro-wordmark-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `logo_asset_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `renderer_version` text DEFAULT 'AP-PDF-ENGINE-1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `render_input_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `render_input_sha256` text DEFAULT '' NOT NULL;