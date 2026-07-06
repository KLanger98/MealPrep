<script setup>
import { Link } from '@inertiajs/vue3';

defineProps({
    recipe: { type: Object, required: true },
});

const costLabels = { low: '$', medium: '$$', high: '$$$' };
</script>

<template>
    <Link
        :href="route('recipes.show', recipe.slug)"
        class="block overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-md"
    >
        <img
            v-if="recipe.image_url"
            :src="recipe.image_url"
            :alt="recipe.title"
            class="h-36 w-full object-cover"
            loading="lazy"
        />
        <div class="p-4">
        <div class="flex items-start justify-between gap-2">
            <h2 class="font-semibold text-stone-900">{{ recipe.title }}</h2>
            <span v-if="recipe.cost" class="shrink-0 text-sm font-medium text-green-700">{{ costLabels[recipe.cost] ?? recipe.cost }}</span>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span class="rounded-full bg-green-50 px-2 py-0.5 font-medium capitalize text-green-800">{{ recipe.type }}</span>
            <span v-if="recipe.protein" class="rounded-full bg-stone-100 px-2 py-0.5 capitalize text-stone-700">{{ recipe.protein }}</span>
            <span v-for="tag in recipe.tags" :key="tag" class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">{{ tag }}</span>
        </div>
        <div class="mt-3 flex gap-4 text-xs text-stone-500">
            <span>{{ recipe.servings }} {{ recipe.servings === 1 ? 'serving' : 'servings' }}</span>
            <span v-if="recipe.total_minutes">{{ recipe.total_minutes }} min</span>
        </div>
        </div>
    </Link>
</template>
