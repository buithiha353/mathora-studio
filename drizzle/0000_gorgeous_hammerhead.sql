CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`project_id` text NOT NULL,
	`cipher_text` text NOT NULL,
	`iv` text NOT NULL,
	`hint` text NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`cooldown_until` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`status` text DEFAULT 'UPLOADED' NOT NULL,
	`page_count` integer DEFAULT 1 NOT NULL,
	`sharpen_profile` text DEFAULT 'NONE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`duration` integer DEFAULT 90 NOT NULL,
	`total_questions` integer NOT NULL,
	`matrix_json` text NOT NULL,
	`question_ids_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `illustrations` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text,
	`prompt` text NOT NULL,
	`mode` text DEFAULT 'CONTEXTUAL_DIAGRAM' NOT NULL,
	`spec_json` text NOT NULL,
	`status` text DEFAULT 'AWAITING_REVIEW' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`stage` text DEFAULT 'UPLOAD' NOT NULL,
	`key_id` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`content` text NOT NULL,
	`latex` text DEFAULT '' NOT NULL,
	`grade` integer DEFAULT 12 NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`type` text DEFAULT 'MULTIPLE_CHOICE' NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`asset_count` integer DEFAULT 0 NOT NULL,
	`source_document_id` text,
	`status` text DEFAULT 'REVIEWED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
