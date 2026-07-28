PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`project_id` text NOT NULL,
	`cipher_text` text NOT NULL,
	`iv` text NOT NULL,
	`hint` text NOT NULL,
	`model` text DEFAULT 'gemini-3.5-flash-lite' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`cooldown_until` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "label", "project_id", "cipher_text", "iv", "hint", "model", "priority", "usage_count", "failure_count", "status", "cooldown_until", "last_used_at", "created_at") SELECT "id", "label", "project_id", "cipher_text", "iv", "hint", "model", "priority", "usage_count", "failure_count", "status", "cooldown_until", "last_used_at", "created_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `image_regions` ADD `page_number` integer DEFAULT 1 NOT NULL;