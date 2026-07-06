<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import RecipeFileEditor from '@/Components/RecipeFileEditor.vue';
import { Head, Link, useForm } from '@inertiajs/vue3';

const props = defineProps({
    recipe: { type: Object, required: true },
    content: { type: String, required: true },
});

const form = useForm({
    content: props.content,
});
</script>

<template>
    <AppLayout>
        <Head :title="`Edit — ${recipe.title}`" />

        <Link :href="route('recipes.show', recipe.slug)" class="text-sm text-stone-500 hover:text-stone-800">← {{ recipe.title }}</Link>

        <h1 class="mt-2 text-2xl font-semibold">Edit {{ recipe.title }}</h1>
        <p class="mt-1 truncate text-sm text-stone-500" :title="recipe.file_path">
            Editing <span class="font-mono">{{ recipe.file_path }}</span>
        </p>

        <RecipeFileEditor
            v-model="form.content"
            class="mt-4"
            :error="form.errors.content"
            :processing="form.processing"
            submit-label="Save changes"
            @submit="form.put(route('recipes.update', recipe.slug))"
        />
    </AppLayout>
</template>
