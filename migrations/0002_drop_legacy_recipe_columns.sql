DROP TABLE `recipe_import_errors`;--> statement-breakpoint
DROP INDEX `recipes_missing_at_idx`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `ingredients`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `image`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `r2_key`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `etag`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `missing_at`;