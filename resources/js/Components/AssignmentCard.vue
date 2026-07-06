<script setup>
import { Link, router } from '@inertiajs/vue3';

const props = defineProps({
    assignment: { type: Object, required: true },
});

const emit = defineEmits(['edit']);

function removeDay() {
    router.delete(route('assignments.destroy', props.assignment.id), { preserveScroll: true });
}

function removeBatch() {
    if (props.assignment.batch_days > 1 && !confirm(`Remove "${props.assignment.recipe.title}" from all ${props.assignment.batch_days} days?`)) {
        return;
    }
    router.delete(route('assignments.batch.destroy', props.assignment.batch_id), { preserveScroll: true });
}
</script>

<template>
    <div class="group rounded-lg border border-stone-200 bg-white p-2 text-xs shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <div class="flex items-start justify-between gap-1">
            <Link :href="route('recipes.show', assignment.recipe.slug)" class="font-medium text-stone-800 hover:text-green-700 dark:text-stone-200 dark:hover:text-green-400">
                {{ assignment.recipe.title }}
            </Link>
            <button
                type="button"
                class="hidden shrink-0 text-stone-400 hover:text-red-600 group-hover:block dark:text-stone-500 dark:hover:text-red-400"
                :title="assignment.batch_days > 1 ? 'Remove this day only' : 'Remove'"
                aria-label="Remove this day"
                @click="removeDay"
            >
                ✕
            </button>
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
            <span v-if="assignment.scale_factor !== 1" class="rounded bg-green-50 px-1 font-medium text-green-700 dark:bg-green-950 dark:text-green-300">×{{ assignment.scale_factor }}</span>
            <span v-if="assignment.batch_range" class="rounded bg-blue-50 px-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300" title="This batch covers multiple days">{{ assignment.batch_range }}</span>
            <span v-if="assignment.recipe.missing" class="rounded bg-red-50 px-1 text-red-700 dark:bg-red-950 dark:text-red-300" title="The recipe file has been deleted or moved">file missing</span>
        </div>

        <div class="mt-1 hidden gap-2 group-hover:flex">
            <button type="button" class="text-[11px] text-stone-400 hover:text-stone-700 dark:hover:text-stone-200" @click="emit('edit', assignment)">Edit batch</button>
            <button v-if="assignment.batch_days > 1" type="button" class="text-[11px] text-stone-400 hover:text-red-600 dark:text-stone-500 dark:hover:text-red-400" @click="removeBatch">
                Remove all days
            </button>
        </div>
    </div>
</template>
