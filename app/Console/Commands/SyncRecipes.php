<?php

namespace App\Console\Commands;

use App\Services\RecipeSyncer;
use Illuminate\Console\Command;

class SyncRecipes extends Command
{
    protected $signature = 'recipes:sync {--force : Re-parse every file even if unchanged}';

    protected $description = 'Scan the recipes directory and update the recipe index';

    public function handle(RecipeSyncer $syncer): int
    {
        $path = config('recipes.path');

        if (! is_dir($path)) {
            $this->warn("Recipes directory does not exist yet: {$path}");

            return self::SUCCESS;
        }

        $result = $syncer->sync(force: (bool) $this->option('force'));

        $this->info(sprintf(
            'Synced %s: %d created, %d updated, %d unchanged, %d missing, %d errors.',
            $path,
            count($result['created']),
            count($result['updated']),
            count($result['unchanged']),
            count($result['missing']),
            count($result['errors']),
        ));

        if ($this->getOutput()->isVerbose()) {
            foreach (['created', 'updated', 'missing'] as $kind) {
                foreach ($result[$kind] as $slug) {
                    $this->line("  <comment>{$kind}</comment>: {$slug}");
                }
            }
        }

        foreach ($result['errors'] as $file => $message) {
            $this->error("  {$file}: {$message}");
        }

        return self::SUCCESS;
    }
}
