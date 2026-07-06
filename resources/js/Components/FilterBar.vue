<script setup>
import { router } from '@inertiajs/vue3';
import { reactive, watch } from 'vue';

const props = defineProps({
    filters: { type: Object, required: true },
    options: { type: Object, required: true },
});

const state = reactive({
    q: props.filters.q ?? '',
    type: props.filters.type ?? '',
    protein: props.filters.protein ?? '',
    cost: props.filters.cost ?? '',
    tag: props.filters.tag ?? '',
});

let searchTimer = null;

function apply() {
    const params = Object.fromEntries(Object.entries(state).filter(([, v]) => v !== ''));
    router.get(route('recipes.index'), params, { preserveState: true, replace: true });
}

watch(() => [state.type, state.protein, state.cost, state.tag], apply);

watch(
    () => state.q,
    () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(apply, 300);
    },
);

function clearAll() {
    Object.keys(state).forEach((k) => (state[k] = ''));
}

const hasFilters = () => Object.values(state).some((v) => v !== '');
</script>

<template>
    <div class="flex flex-wrap items-center gap-2">
        <input
            v-model="state.q"
            type="search"
            placeholder="Search recipes or ingredients…"
            class="w-64 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-stone-700 dark:bg-stone-900"
        />
        <select v-model="state.type" class="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm capitalize dark:border-stone-700 dark:bg-stone-900">
            <option value="">All types</option>
            <option v-for="type in options.types" :key="type" :value="type">{{ type }}</option>
        </select>
        <select v-model="state.protein" class="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm capitalize dark:border-stone-700 dark:bg-stone-900">
            <option value="">All proteins</option>
            <option v-for="protein in options.proteins" :key="protein" :value="protein">{{ protein }}</option>
        </select>
        <select v-model="state.cost" class="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900">
            <option value="">Any cost</option>
            <option v-for="cost in options.costs" :key="cost" :value="cost">{{ cost }}</option>
        </select>
        <select v-model="state.tag" class="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900">
            <option value="">All tags</option>
            <option v-for="tag in options.tags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
        <button v-if="hasFilters()" type="button" class="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200" @click="clearAll">
            Clear
        </button>
    </div>
</template>
