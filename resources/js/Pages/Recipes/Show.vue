<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import IngredientList from '@/Components/IngredientList.vue';
import { Head, Link, router } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    recipe: { type: Object, required: true },
});

function destroyRecipe() {
    if (confirm(`Delete "${props.recipe.title}"? This deletes the .md file and removes it from any meal plans.`)) {
        router.delete(route('recipes.destroy', props.recipe.slug));
    }
}

const hoverRating = ref(null);

function setRating(value) {
    // Clicking the current rating clears it.
    const rating = value === props.recipe.rating ? null : value;
    router.patch(route('recipes.rate', props.recipe.slug), { rating }, { preserveScroll: true });
}

const photoInput = ref(null);
const photoError = ref(null);
const uploadingPhoto = ref(false);

function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    photoError.value = null;
    uploadingPhoto.value = true;

    router.post(route('recipes.image.store', props.recipe.slug), { photo: file }, {
        forceFormData: true,
        preserveScroll: true,
        onError: (errors) => (photoError.value = errors.photo),
        onFinish: () => {
            uploadingPhoto.value = false;
            event.target.value = '';
        },
    });
}

function removePhoto() {
    if (confirm('Remove this photo? The image file will be deleted from the recipes folder.')) {
        router.delete(route('recipes.image.destroy', props.recipe.slug), { preserveScroll: true });
    }
}

const sourceIsUrl = computed(() => /^https?:\/\//i.test(props.recipe.source ?? ''));

const sourceLabel = computed(() => {
    if (!sourceIsUrl.value) return props.recipe.source;
    try {
        return new URL(props.recipe.source).hostname.replace(/^www\./, '');
    } catch {
        return props.recipe.source;
    }
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

        <div class="group/photo relative mt-4">
            <img
                v-if="recipe.image_url"
                :src="recipe.image_url"
                :alt="recipe.title"
                class="max-h-80 w-full rounded-xl object-cover"
            />
            <div
                class="flex gap-2"
                :class="recipe.image_url ? 'absolute bottom-3 right-3' : ''"
            >
                <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-sm shadow-sm"
                    :class="recipe.image_url ? 'bg-white/90 text-stone-700 hover:bg-white' : 'border border-dashed border-stone-300 text-stone-500 hover:border-green-400 hover:text-green-700'"
                    :disabled="uploadingPhoto"
                    @click="photoInput.click()"
                >
                    {{ uploadingPhoto ? 'Uploading…' : recipe.image_url ? 'Change photo' : '+ Add photo' }}
                </button>
                <button
                    v-if="recipe.image_url"
                    type="button"
                    class="rounded-lg bg-white/90 px-3 py-1.5 text-sm text-red-600 shadow-sm hover:bg-white"
                    @click="removePhoto"
                >
                    Remove
                </button>
            </div>
            <input
                ref="photoInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="uploadPhoto"
            />
        </div>
        <p v-if="photoError" class="mt-2 text-sm text-red-600">{{ photoError }}</p>

        <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 class="text-3xl font-semibold">{{ recipe.title }}</h1>
                <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="rounded-full bg-green-50 px-2 py-0.5 font-medium capitalize text-green-800">{{ recipe.type }}</span>
                    <span v-if="recipe.protein" class="rounded-full bg-stone-100 px-2 py-0.5 capitalize text-stone-700">{{ recipe.protein }}</span>
                    <span v-if="recipe.cost" class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{{ costLabels[recipe.cost] ?? recipe.cost }}</span>
                    <span v-for="tag in recipe.tags" :key="tag" class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">{{ tag }}</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-4 text-sm text-stone-500">
                    <span v-if="recipe.prep_minutes">Prep {{ recipe.prep_minutes }} min</span>
                    <span v-if="recipe.cook_minutes">Cook {{ recipe.cook_minutes }} min</span>
                    <span v-if="recipe.source">
                        Source:
                        <a v-if="sourceIsUrl" :href="recipe.source" target="_blank" rel="noopener" class="text-green-700 underline underline-offset-2 hover:text-green-800">{{ sourceLabel }}</a>
                        <span v-else>{{ recipe.source }}</span>
                    </span>
                </div>

                <div class="mt-3 flex items-center gap-1" @mouseleave="hoverRating = null">
                    <span class="mr-1 text-sm text-stone-500">Rating:</span>
                    <button
                        v-for="star in 10"
                        :key="star"
                        type="button"
                        class="text-lg leading-none transition-colors"
                        :class="star <= (hoverRating ?? recipe.rating ?? 0) ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'"
                        :title="`${star}/10${star === recipe.rating ? ' (click to clear)' : ''}`"
                        @mouseenter="hoverRating = star"
                        @click="setRating(star)"
                    >
                        ★
                    </button>
                    <span v-if="recipe.rating !== null" class="ml-1 text-sm font-medium text-stone-700">{{ recipe.rating }}/10</span>
                    <span v-else class="ml-1 text-sm text-stone-400">not rated</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Link
                    v-if="!recipe.missing"
                    :href="route('recipes.edit', recipe.slug)"
                    class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
                >
                    Edit
                </Link>
                <button
                    type="button"
                    class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    @click="destroyRecipe"
                >
                    Delete
                </button>
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
