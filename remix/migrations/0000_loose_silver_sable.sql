CREATE TABLE `meal_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`batch_id` text NOT NULL,
	`scale_factor` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_assignments_date_idx` ON `meal_assignments` (`date`);--> statement-breakpoint
CREATE INDEX `meal_assignments_batch_id_idx` ON `meal_assignments` (`batch_id`);--> statement-breakpoint
CREATE TABLE `recipe_import_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`r2_key` text NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`protein` text,
	`cost` text,
	`source` text,
	`rating` real,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`servings` integer DEFAULT 1 NOT NULL,
	`tags` text,
	`ingredients` text NOT NULL,
	`body_markdown` text,
	`image` text,
	`meta` text,
	`r2_key` text NOT NULL,
	`etag` text NOT NULL,
	`image_key` text,
	`image_etag` text,
	`missing_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_slug_unique` ON `recipes` (`slug`);--> statement-breakpoint
CREATE INDEX `recipes_type_idx` ON `recipes` (`type`);--> statement-breakpoint
CREATE INDEX `recipes_protein_idx` ON `recipes` (`protein`);--> statement-breakpoint
CREATE INDEX `recipes_cost_idx` ON `recipes` (`cost`);--> statement-breakpoint
CREATE INDEX `recipes_missing_at_idx` ON `recipes` (`missing_at`);--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopping_list_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` real,
	`unit` text,
	`category` text DEFAULT 'other' NOT NULL,
	`sources` text NOT NULL,
	`checked_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shopping_list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_list_idx` ON `shopping_list_items` (`shopping_list_id`);--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
