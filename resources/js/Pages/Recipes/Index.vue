<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import FilterBar from '@/Components/FilterBar.vue';
import RecipeCard from '@/Components/RecipeCard.vue';
import SyncErrorBanner from '@/Components/SyncErrorBanner.vue';
import { Head } from '@inertiajs/vue3';

defineProps({
    recipes: { type: Array, required: true },
    filters: { type: Object, required: true },
    filterOptions: { type: Object, required: true },
});
</script>

<template>
    <AppLayout>
        <Head title="Recipes" />
        <SyncErrorBanner />

        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-semibold">Recipes</h1>
            <FilterBar :filters="filters" :options="filterOptions" />
        </div>

        <div v-if="recipes.length" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RecipeCard v-for="recipe in recipes" :key="recipe.slug" :recipe="recipe" />
        </div>

        <div v-else class="mt-16 text-center text-stone-500">
            <p class="text-lg font-medium">No recipes found</p>
            <p class="mt-1 text-sm">
                Drop a <span class="font-mono">.md</span> file into the <span class="font-mono">recipes/</span> folder
                (see <span class="font-mono">recipes/SCHEMA.md</span>) and refresh.
            </p>
        </div>
    </AppLayout>
</template>
