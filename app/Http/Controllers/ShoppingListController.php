<?php

namespace App\Http\Controllers;

use App\Models\ShoppingList;
use App\Services\ShoppingListGenerator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShoppingListController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('ShoppingLists/Index', [
            'lists' => ShoppingList::withCount([
                'items',
                'items as checked_items_count' => fn ($q) => $q->whereNotNull('checked_at'),
            ])
                ->latest()
                ->get()
                ->map(fn (ShoppingList $list) => [
                    'id' => $list->id,
                    'name' => $list->name,
                    'start_date' => $list->start_date->toDateString(),
                    'end_date' => $list->end_date->toDateString(),
                    'label' => $list->start_date->format('j M').' – '.$list->end_date->format('j M Y'),
                    'items_count' => $list->items_count,
                    'checked_items_count' => $list->checked_items_count,
                ]),
            'defaultRange' => [
                'start' => now()->startOfWeek()->toDateString(),
                'end' => now()->endOfWeek()->toDateString(),
            ],
        ]);
    }

    public function store(Request $request, ShoppingListGenerator $generator): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $list = ShoppingList::create($validated);
        $generator->generate($list);

        return redirect()->route('shopping-lists.show', $list);
    }

    public function show(ShoppingList $shoppingList): Response
    {
        $shoppingList->load('items');

        return Inertia::render('ShoppingLists/Show', [
            'list' => [
                'id' => $shoppingList->id,
                'name' => $shoppingList->name,
                'label' => $shoppingList->start_date->format('j M').' – '.$shoppingList->end_date->format('j M Y'),
                'items' => $shoppingList->items->map(fn ($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'quantity' => $item->quantity,
                    'unit' => $item->unit,
                    'category' => $item->category,
                    'sources' => $item->sources,
                    'checked' => $item->checked_at !== null,
                ]),
            ],
        ]);
    }

    public function regenerate(ShoppingList $shoppingList, ShoppingListGenerator $generator): RedirectResponse
    {
        $generator->generate($shoppingList);

        return back();
    }

    public function destroy(ShoppingList $shoppingList): RedirectResponse
    {
        $shoppingList->delete();

        return redirect()->route('shopping-lists.index');
    }
}
