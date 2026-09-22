CREATE TABLE `meal_assignment_people` (
	`assignment_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	PRIMARY KEY(`assignment_id`, `person_id`),
	FOREIGN KEY (`assignment_id`) REFERENCES `meal_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_assignment_people_person_idx` ON `meal_assignment_people` (`person_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_name_unique` ON `people` (`name`);