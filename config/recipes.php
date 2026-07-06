<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Recipe Files Path
    |--------------------------------------------------------------------------
    |
    | The directory that holds the recipe .md files. Files are the source of
    | truth; the database only keeps a rebuildable index of them. Point this
    | anywhere via RECIPES_PATH if you move the folder later.
    |
    */

    'path' => env('RECIPES_PATH', base_path('recipes')),

    /*
    |--------------------------------------------------------------------------
    | Ignored Files
    |--------------------------------------------------------------------------
    |
    | Markdown files in the recipes directory that are documentation, not
    | recipes. Matched against the basename.
    |
    */

    'ignore' => ['SCHEMA.md', 'README.md'],

    /*
    |--------------------------------------------------------------------------
    | Sync Debounce (seconds)
    |--------------------------------------------------------------------------
    |
    | The web middleware re-scans the recipes directory at most once per this
    | many seconds, so rapid Inertia navigation doesn't rescan on every click.
    |
    */

    'sync_debounce' => env('RECIPES_SYNC_DEBOUNCE', 2),

];
