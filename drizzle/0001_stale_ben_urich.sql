PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`content` text NOT NULL,
	`latex` text DEFAULT '' NOT NULL,
	`grade` integer DEFAULT 9 NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`type` text DEFAULT 'MULTIPLE_CHOICE' NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`asset_count` integer DEFAULT 0 NOT NULL,
	`source_document_id` text,
	`status` text DEFAULT 'REVIEWED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "code", "content", "latex", "grade", "topic", "difficulty", "type", "answer", "asset_count", "source_document_id", "status", "created_at") SELECT "id", "code", "content", "latex", "grade", "topic", "difficulty", "type", "answer", "asset_count", "source_document_id", "status", "created_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;