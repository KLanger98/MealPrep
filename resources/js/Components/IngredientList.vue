<script setup>
import { formatAmount } from '@/lib/quantity';

defineProps({
    ingredients: { type: Array, required: true },
    scale: { type: Number, default: 1 },
});

function scaledAmount(ingredient, scale) {
    if (ingredient.quantity === null || ingredient.quantity === undefined) return '';
    return formatAmount(ingredient.quantity * scale, ingredient.unit);
}
</script>

<template>
    <ul class="divide-y divide-stone-100 dark:divide-stone-800">
        <li v-for="(ingredient, i) in ingredients" :key="i" class="flex items-baseline gap-2 py-1.5">
            <span class="min-w-20 shrink-0 font-medium tabular-nums" :class="{ 'text-stone-400 dark:text-stone-500': !scaledAmount(ingredient, scale) }">
                {{ scaledAmount(ingredient, scale) || '—' }}
            </span>
            <span>
                {{ ingredient.name }}
                <span v-if="ingredient.note" class="text-sm text-stone-500 dark:text-stone-400">({{ ingredient.note }})</span>
            </span>
        </li>
    </ul>
</template>
