CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_unique` ON `ingredients` (`name`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity` real,
	`unit` text,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredients_ingredient_idx` ON `recipe_ingredients` (`ingredient_id`);
--> statement-breakpoint
-- Backfill (hand-written; drizzle-kit only generates schema changes).
-- One ingredient per distinct normalised name. Where recipes disagreed on the
-- category, the most common one wins.
INSERT INTO `ingredients` (`name`, `category`, `created_at`, `updated_at`)
SELECT
	n.`name`,
	(
		SELECT lower(trim(je2.value ->> 'category'))
		FROM `recipes` r2, json_each(r2.`ingredients`) je2
		WHERE lower(trim(je2.value ->> 'name')) = n.`name`
			AND trim(coalesce(je2.value ->> 'category', '')) <> ''
		GROUP BY 1
		ORDER BY count(*) DESC, 1
		LIMIT 1
	),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
	SELECT DISTINCT lower(trim(je.value ->> 'name')) AS `name`
	FROM `recipes` r, json_each(r.`ingredients`) je
) n
WHERE n.`name` IS NOT NULL AND n.`name` <> '';
--> statement-breakpoint
-- One row per recipe line, in file order (json_each's key is the array index).
INSERT INTO `recipe_ingredients` (`recipe_id`, `ingredient_id`, `quantity`, `unit`, `note`, `sort_order`)
SELECT
	r.`id`,
	i.`id`,
	je.value ->> 'quantity',
	je.value ->> 'unit',
	je.value ->> 'note',
	je.key
FROM `recipes` r, json_each(r.`ingredients`) je
JOIN `ingredients` i ON i.`name` = lower(trim(je.value ->> 'name'));
