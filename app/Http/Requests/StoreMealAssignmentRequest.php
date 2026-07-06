<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMealAssignmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'recipe_id' => ['required', 'exists:recipes,id'],
            'slot' => ['required', Rule::in(config('mealplan.slots'))],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'scale_factor' => ['required', 'numeric', 'min:0.1', 'max:20'],
        ];
    }
}
