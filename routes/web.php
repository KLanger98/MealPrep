<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\MealAssignmentController;
use App\Http\Controllers\RecipeController;
use App\Http\Controllers\ShoppingListController;
use App\Http\Controllers\ShoppingListItemController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/recipes');

Route::get('/recipes', [RecipeController::class, 'index'])->name('recipes.index');
Route::get('/recipes/create', [RecipeController::class, 'create'])->name('recipes.create');
Route::post('/recipes', [RecipeController::class, 'store'])->name('recipes.store');
Route::get('/recipes/{recipe:slug}', [RecipeController::class, 'show'])->name('recipes.show');
Route::get('/recipes/{recipe:slug}/edit', [RecipeController::class, 'edit'])->name('recipes.edit');
Route::put('/recipes/{recipe:slug}', [RecipeController::class, 'update'])->name('recipes.update');
Route::delete('/recipes/{recipe:slug}', [RecipeController::class, 'destroy'])->name('recipes.destroy');
Route::get('/recipes/{recipe:slug}/image', [RecipeController::class, 'image'])->name('recipes.image');
Route::patch('/recipes/{recipe:slug}/rating', [RecipeController::class, 'rate'])->name('recipes.rate');

Route::get('/calendar', [CalendarController::class, 'index'])->name('calendar.index');

Route::post('/assignments', [MealAssignmentController::class, 'store'])->name('assignments.store');
Route::patch('/assignments/batch/{batchId}', [MealAssignmentController::class, 'updateBatch'])->name('assignments.batch.update');
Route::delete('/assignments/batch/{batchId}', [MealAssignmentController::class, 'destroyBatch'])->name('assignments.batch.destroy');
Route::delete('/assignments/{assignment}', [MealAssignmentController::class, 'destroyDay'])->name('assignments.destroy');
Route::get('/shopping-lists', [ShoppingListController::class, 'index'])->name('shopping-lists.index');
Route::post('/shopping-lists', [ShoppingListController::class, 'store'])->name('shopping-lists.store');
Route::get('/shopping-lists/{shoppingList}', [ShoppingListController::class, 'show'])->name('shopping-lists.show');
Route::post('/shopping-lists/{shoppingList}/regenerate', [ShoppingListController::class, 'regenerate'])->name('shopping-lists.regenerate');
Route::delete('/shopping-lists/{shoppingList}', [ShoppingListController::class, 'destroy'])->name('shopping-lists.destroy');
Route::patch('/shopping-list-items/{item}/toggle', [ShoppingListItemController::class, 'toggle'])->name('shopping-list-items.toggle');
