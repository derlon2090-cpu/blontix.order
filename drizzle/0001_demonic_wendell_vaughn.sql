CREATE TABLE `document_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`event_type` text NOT NULL,
	`result` text NOT NULL,
	`actor_id` text,
	`previous_hash` text NOT NULL,
	`event_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_document_audit_document_created` ON `document_audit_logs` (`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `verification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_events_document_created` ON `verification_events` (`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `verification_rate_limits` (
	`subject_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`subject_hash`, `window_start`)
);
--> statement-breakpoint
ALTER TABLE `order_documents` ADD `finalized_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `verification_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `verification_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `pdf_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `template_version` text DEFAULT 'AP-DOC-V1' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `branding_version` text DEFAULT 'AP-BRAND-V1' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `logo_asset_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `lifecycle_status` text DEFAULT 'final' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `supersedes_document_id` text;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `reissue_reason` text;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `idempotency_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `signed_at` text;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `certificate_fingerprint` text;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `certificate_serial` text;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `signature_status` text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `timestamp_status` text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_documents` ADD `timestamp_authority_result` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_documents_verification_token` ON `order_documents` (`verification_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_documents_verification_id` ON `order_documents` (`verification_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_documents_idempotency_key` ON `order_documents` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_order_documents_status_created` ON `order_documents` (`lifecycle_status`,`created_at`);