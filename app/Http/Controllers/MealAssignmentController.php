<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMealAssignmentRequest;
use App\Models\MealAssignment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MealAssignmentController extends Controller
{
    /**
     * Assign a recipe to a slot across a date range: one row per day,
     * linked by a shared batch_id (a batch = one cook of the recipe).
     */
    public function store(StoreMealAssignmentRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);
        $batchId = (string) Str::uuid();

        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            MealAssignment::create([
                'recipe_id' => $validated['recipe_id'],
                'date' => $date->toDateString(),
                'slot' => $validated['slot'],
                'batch_id' => $batchId,
                'scale_factor' => $validated['scale_factor'],
            ]);
        }

        return back();
    }

    /**
     * Update every day in a batch (scale and/or slot) in one go.
     */
    public function updateBatch(Request $request, string $batchId): RedirectResponse
    {
        $validated = $request->validate([
            'scale_factor' => ['sometimes', 'numeric', 'min:0.1', 'max:20'],
            'slot' => ['sometimes', Rule::in(config('mealplan.slots'))],
        ]);

        MealAssignment::where('batch_id', $batchId)->update($validated);

        return back();
    }

    /**
     * Remove a single day from a batch.
     */
    public function destroyDay(MealAssignment $assignment): RedirectResponse
    {
        $assignment->delete();

        return back();
    }

    /**
     * Remove the whole batch (every day it covers).
     */
    public function destroyBatch(string $batchId): RedirectResponse
    {
        MealAssignment::where('batch_id', $batchId)->delete();

        return back();
    }
}
