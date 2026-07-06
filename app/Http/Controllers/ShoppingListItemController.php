<?php

namespace App\Http\Controllers;

use App\Models\ShoppingListItem;
use Illuminate\Http\RedirectResponse;

class ShoppingListItemController extends Controller
{
    public function toggle(ShoppingListItem $item): RedirectResponse
    {
        $item->update([
            'checked_at' => $item->checked_at === null ? now() : null,
        ]);

        return back();
    }
}
