CREATE TABLE `order_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`masked_phone` text NOT NULL,
	`product_name` text NOT NULL,
	`price` text NOT NULL,
	`order_approved_at` text NOT NULL,
	`delivered_at` text NOT NULL,
	`delivery_method` text NOT NULL,
	`status` text DEFAULT 'final' NOT NULL,
	`document_reference` text NOT NULL,
	`document_version` integer DEFAULT 1 NOT NULL,
	`terms_version` text DEFAULT '1' NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`image_key` text NOT NULL,
	`image_content_type` text NOT NULL,
	`pdf_key` text NOT NULL,
	`created_at` text NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_documents_reference` ON `order_documents` (`document_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_documents_order_version` ON `order_documents` (`order_number`,`document_version`);