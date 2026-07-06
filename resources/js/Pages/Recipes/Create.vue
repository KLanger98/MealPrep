<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import RecipeFileEditor from '@/Components/RecipeFileEditor.vue';
import { Head, Link, useForm } from '@inertiajs/vue3';

const props = defineProps({
    template: { type: String, required: true },
});

const form = useForm({
    content: props.template,
});
</script>

<template>
    <AppLayout>
        <Head title="New recipe" />

        <Link :href="route('recipes.index')" class="text-sm text-stone-500 hover:text-stone-800">← All recipes</Link>

        <h1 class="mt-2 text-2xl font-semibold">New recipe</h1>
        <p class="mt-1 text-sm text-stone-500">
            This creates a <span class="font-mono">.md</span> file in your recipes folder — the same thing an AI (or you, in a text editor) would write.
        </p>

        <RecipeFileEditor
            v-model="form.content"
            class="mt-4"
            :error="form.errors.content"
            :processing="form.processing"
            submit-label="Create recipe"
            @submit="form.post(route('recipes.store'))"
        />
    </AppLayout>
</template>
