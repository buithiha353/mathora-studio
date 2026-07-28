CREATE TABLE `app_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
