<?php

namespace App\Http\Controllers;

use App\Models\MealAssignment;
use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $start = Carbon::parse($request->query('week', 'now'))->startOfWeek();
        $end = $start->copy()->endOfWeek();

        $assignments = MealAssignment::with('recipe')
            ->betweenDates($start->toDateString(), $end->toDateString())
            ->orderBy('date')
            ->get();

        // Span info per batch so cards can show "Mon–Wed ×1.5". A batch can
        // extend beyond this week; use its full range.
        $batchRanges = MealAssignment::whereIn('batch_id', $assignments->pluck('batch_id')->unique())
            ->selectRaw('batch_id, min(date) as first_date, max(date) as last_date, count(*) as day_count')
            ->groupBy('batch_id')
            ->get()
            ->keyBy('batch_id');

        return Inertia::render('Calendar/Index', [
            'weekStart' => $start->toDateString(),
            'days' => collect(range(0, 6))->map(fn ($i) => [
                'date' => $start->copy()->addDays($i)->toDateString(),
                'dayName' => $start->copy()->addDays($i)->format('D'),
                'dayNumber' => $start->copy()->addDays($i)->format('j M'),
                'isToday' => $start->copy()->addDays($i)->isToday(),
            ]),
            'slots' => config('mealplan.slots'),
            'assignments' => $assignments->map(function (MealAssignment $assignment) use ($batchRanges) {
                $range = $batchRanges[$assignment->batch_id];

                return [
                    'id' => $assignment->id,
                    'batch_id' => $assignment->batch_id,
                    'date' => $assignment->date->toDateString(),
                    'slot' => $assignment->slot,
                    'scale_factor' => $assignment->scale_factor,
                    'batch_days' => (int) $range->day_count,
                    'batch_range' => $range->day_count > 1
                        ? Carbon::parse($range->first_date)->format('D j').' – '.Carbon::parse($range->last_date)->format('D j')
                        : null,
                    'recipe' => [
                        'slug' => $assignment->recipe->slug,
                        'title' => $assignment->recipe->title,
                        'servings' => $assignment->recipe->servings,
                        'missing' => $assignment->recipe->missing_at !== null,
                    ],
                ];
            }),
            'recipeOptions' => Recipe::available()
                ->orderBy('title')
                ->get(['id', 'slug', 'title', 'servings', 'type'])
                ->map(fn (Recipe $recipe) => [
                    'id' => $recipe->id,
                    'slug' => $recipe->slug,
                    'title' => $recipe->title,
                    'servings' => $recipe->servings,
                    'type' => $recipe->type,
                ]),
        ]);
    }
}
