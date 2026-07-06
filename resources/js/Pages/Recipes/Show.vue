<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import IngredientList from '@/Components/IngredientList.vue';
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    recipe: { type: Object, required: true },
});

// Display-only scaling: nothing here is persisted.
const targetServings = ref(props.recipe.servings);
const scale = computed(() => targetServings.value / props.recipe.servings);

const presets = [0.5, 1, 1.5, 2];

function applyPreset(factor) {
    targetServings.value = Math.round(props.recipe.servings * factor * 100) / 100;
}

const costLabels = { low: '$', medium: '$$', high: '$$$' };
</script>

<template>
    <AppLayout>
        <Head :title="recipe.title" />

        <Link :href="route('recipes.index')" class="text-sm text-stone-500 hover:text-stone-800">← All recipes</Link>

        <div v-if="recipe.missing" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            The file for this recipe (<span class="font-mono">{{ recipe.file_path }}</span>) is missing. Showing the last indexed version.
        </div>

        <img
            v-if="recipe.image_url"
            :src="recipe.image_url"
            :alt="recipe.title"
            class="mt-4 max-h-80 w-full rounded-xl object-cover"
        />

        <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 class="text-3xl font-semibold">{{ recipe.title }}</h1>
                <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="rounded-full bg-green-50 px-2 py-0.5 font-medium capitalize text-green-800">{{ recipe.type }}</span>
                    <span v-if="recipe.protein" class="rounded-full bg-stone-100 px-2 py-0.5 capitalize text-stone-700">{{ recipe.protein }}</span>
                    <span v-if="recipe.cost" class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{{ costLabels[recipe.cost] ?? recipe.cost }}</span>
                    <span v-for="tag in recipe.tags" :key="tag" class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">{{ tag }}</span>
                </div>
                <div class="mt-2 flex gap-4 text-sm text-stone-500">
                    <span v-if="recipe.prep_minutes">Prep {{ recipe.prep_minutes }} min</span>
                    <span v-if="recipe.cook_minutes">Cook {{ recipe.cook_minutes }} min</span>
                </div>
            </div>
        </div>

        <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(280px,1fr)_2fr]">
            <aside>
                <div class="rounded-xl border border-stone-200 bg-white p-4">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="font-semibold">Ingredients</h2>
                        <div class="flex items-center gap-1">
                            <button
                                v-for="factor in presets"
                                :key="factor"
                                type="button"
                                class="rounded-md px-2 py-1 text-xs font-medium"
                                :class="Math.abs(scale - factor) < 0.001 ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'"
                                @click="applyPreset(factor)"
                            >
                                {{ factor }}×
                            </button>
                        </div>
                    </div>

                    <label class="mt-3 flex items-center gap-2 text-sm text-stone-600">
                        <span>Servings:</span>
                        <input
                            v-model.number="targetServings"
                            type="number"
                            min="0.5"
                            step="0.5"
                            class="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm"
                        />
                        <span v-if="Math.abs(scale - 1) > 0.001" class="text-xs text-green-700">({{ Math.round(scale * 100) / 100 }}× recipe)</span>
                    </label>

                    <IngredientList class="mt-3" :ingredients="recipe.ingredients" :scale="scale" />
                </div>
            </aside>

            <article class="prose prose-stone max-w-none prose-headings:font-semibold" v-html="recipe.body_html" />
        </div>
    </AppLayout>
</template>
