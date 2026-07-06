<?php

namespace App\Http\Middleware;

use App\Services\RecipeSyncer;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class SyncRecipes
{
    public function __construct(
        private RecipeSyncer $syncer,
    ) {
    }

    /**
     * Keep the recipe index fresh on every page view, debounced so rapid
     * Inertia navigation doesn't rescan the directory on each click.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $debounce = (int) config('recipes.sync_debounce', 2);

        if (Cache::add('recipes.sync.debounce', true, $debounce)) {
            $this->syncer->sync();
        }

        return $next($request);
    }
}
