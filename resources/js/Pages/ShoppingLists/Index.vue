<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import SyncErrorBanner from '@/Components/SyncErrorBanner.vue';
import { Head, Link, router, useForm } from '@inertiajs/vue3';

const props = defineProps({
    lists: { type: Array, required: true },
    defaultRange: { type: Object, required: true },
});

const form = useForm({
    name: '',
    start_date: props.defaultRange.start,
    end_date: props.defaultRange.end,
});

function submit() {
    form.post(route('shopping-lists.store'));
}

function destroyList(list) {
    if (confirm(`Delete the list for ${list.label}?`)) {
        router.delete(route('shopping-lists.destroy', list.id));
    }
}
</script>

<template>
    <AppLayout>
        <Head title="Shopping Lists" />
        <SyncErrorBanner />

        <h1 class="text-2xl font-semibold">Shopping Lists</h1>

        <form class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4" @submit.prevent="submit">
            <label class="text-sm font-medium text-stone-700">
                From
                <input v-model="form.start_date" type="date" required class="mt-1 block rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            </label>
            <label class="text-sm font-medium text-stone-700">
                To
                <input v-model="form.end_date" type="date" required :min="form.start_date" class="mt-1 block rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            </label>
            <label class="flex-1 text-sm font-medium text-stone-700">
                Name <span class="font-normal text-stone-400">(optional)</span>
                <input v-model="form.name" type="text" placeholder="e.g. Week 28 shop" class="mt-1 block w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
            </label>
            <button
                type="submit"
                class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                :disabled="form.processing"
            >
                Generate list
            </button>
            <p v-if="form.errors.end_date" class="w-full text-sm text-red-600">{{ form.errors.end_date }}</p>
        </form>
        <p class="mt-2 text-xs text-stone-500">
            Gathers ingredients from every recipe on the calendar in that range. A batch that overlaps the range is included in full (you cook the whole batch).
        </p>

        <div v-if="lists.length" class="mt-6 space-y-2">
            <div
                v-for="list in lists"
                :key="list.id"
                class="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3"
            >
                <Link :href="route('shopping-lists.show', list.id)" class="flex-1">
                    <span class="font-medium text-stone-800 hover:text-green-700">{{ list.name || list.label }}</span>
                    <span v-if="list.name" class="ml-2 text-sm text-stone-500">{{ list.label }}</span>
                </Link>
                <span class="text-sm text-stone-500">{{ list.checked_items_count }}/{{ list.items_count }} ticked</span>
                <button type="button" class="text-sm text-stone-400 hover:text-red-600" @click="destroyList(list)">Delete</button>
            </div>
        </div>

        <p v-else class="mt-10 text-center text-stone-500">No lists yet — pick a date range above and generate one.</p>
    </AppLayout>
</template>
