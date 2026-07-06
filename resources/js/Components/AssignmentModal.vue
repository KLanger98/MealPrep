<script setup>
import { router } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    show: { type: Boolean, default: false },
    recipes: { type: Array, required: true },
    slots: { type: Array, required: true },
    // Prefill for a new assignment: { date, slot }. For editing: { assignment }.
    context: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close']);

const isEdit = computed(() => !!props.context.assignment);

const form = ref({
    recipe_id: null,
    slot: 'dinner',
    start_date: '',
    end_date: '',
    scale_factor: 1,
});

const search = ref('');
const submitting = ref(false);

watch(
    () => props.show,
    (show) => {
        if (!show) return;
        search.value = '';
        if (isEdit.value) {
            const a = props.context.assignment;
            form.value = {
                recipe_id: null,
                slot: a.slot,
                start_date: '',
                end_date: '',
                scale_factor: a.scale_factor,
            };
        } else {
            form.value = {
                recipe_id: null,
                slot: props.context.slot ?? 'dinner',
                start_date: props.context.date ?? '',
                end_date: props.context.date ?? '',
                scale_factor: 1,
            };
        }
    },
);

const filteredRecipes = computed(() => {
    const term = search.value.toLowerCase().trim();
    if (!term) return props.recipes;
    return props.recipes.filter((r) => r.title.toLowerCase().includes(term));
});

const selectedRecipe = computed(() => props.recipes.find((r) => r.id === form.value.recipe_id));

const totalServings = computed(() => {
    if (!selectedRecipe.value) return null;
    return Math.round(selectedRecipe.value.servings * form.value.scale_factor * 100) / 100;
});

function submit() {
    submitting.value = true;

    if (isEdit.value) {
        router.patch(
            route('assignments.batch.update', props.context.assignment.batch_id),
            { scale_factor: form.value.scale_factor, slot: form.value.slot },
            { preserveScroll: true, onFinish: () => { submitting.value = false; emit('close'); } },
        );
        return;
    }

    router.post(route('assignments.store'), form.value, {
        preserveScroll: true,
        onFinish: () => { submitting.value = false; },
        onSuccess: () => emit('close'),
    });
}
</script>

<template>
    <Teleport to="body">
        <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
            <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                <h2 class="text-lg font-semibold">
                    {{ isEdit ? `Edit batch — ${context.assignment.recipe.title}` : 'Add to calendar' }}
                </h2>

                <form class="mt-4 space-y-4" @submit.prevent="submit">
                    <div v-if="!isEdit">
                        <label class="block text-sm font-medium text-stone-700">Recipe</label>
                        <input
                            v-model="search"
                            type="search"
                            placeholder="Search…"
                            class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                        />
                        <div class="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-1">
                            <button
                                v-for="recipe in filteredRecipes"
                                :key="recipe.id"
                                type="button"
                                class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm"
                                :class="form.recipe_id === recipe.id ? 'bg-green-600 text-white' : 'hover:bg-stone-100'"
                                @click="form.recipe_id = recipe.id"
                            >
                                <span>{{ recipe.title }}</span>
                                <span class="text-xs opacity-70">{{ recipe.servings }} serv · {{ recipe.type }}</span>
                            </button>
                            <p v-if="!filteredRecipes.length" class="px-2 py-1.5 text-sm text-stone-400">No matches.</p>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <label class="flex-1 text-sm font-medium text-stone-700">
                            Slot
                            <select v-model="form.slot" class="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm capitalize">
                                <option v-for="slot in slots" :key="slot" :value="slot">{{ slot }}</option>
                            </select>
                        </label>
                        <label class="flex-1 text-sm font-medium text-stone-700">
                            Scale
                            <input
                                v-model.number="form.scale_factor"
                                type="number"
                                min="0.1"
                                max="20"
                                step="any"
                                class="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                            />
                        </label>
                    </div>

                    <p v-if="totalServings" class="text-xs text-stone-500">
                        Makes {{ totalServings }} servings ({{ selectedRecipe.servings }} × {{ form.scale_factor }}).
                    </p>

                    <div v-if="!isEdit" class="flex gap-3">
                        <label class="flex-1 text-sm font-medium text-stone-700">
                            From
                            <input v-model="form.start_date" type="date" required class="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
                        </label>
                        <label class="flex-1 text-sm font-medium text-stone-700">
                            To
                            <input v-model="form.end_date" type="date" required :min="form.start_date" class="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
                        </label>
                    </div>

                    <p v-if="!isEdit" class="text-xs text-stone-500">
                        Covering multiple days means one cook (one batch) eaten across those days.
                    </p>

                    <div class="flex justify-end gap-2 pt-2">
                        <button type="button" class="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100" @click="emit('close')">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            :disabled="submitting || (!isEdit && !form.recipe_id)"
                        >
                            {{ isEdit ? 'Save batch' : 'Add' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
