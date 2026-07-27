CREATE TABLE `image_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`question_id` text,
	`question_code` text NOT NULL,
	`label` text NOT NULL,
	`region_type` text DEFAULT 'geometry' NOT NULL,
	`box_json` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'AWAITING_REVIEW' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
