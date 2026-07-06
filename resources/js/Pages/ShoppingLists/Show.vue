<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import { Head, Link, router } from '@inertiajs/vue3';
import { computed } from 'vue';
import { formatAmount } from '@/lib/quantity';

const props = defineProps({
    list: { type: Object, required: true },
});

const groups = computed(() => {
    const map = new Map();
    for (const item of props.list.items) {
        if (!map.has(item.category)) map.set(item.category, []);
        map.get(item.category).push(item);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
});

const checkedCount = computed(() => props.list.items.filter((i) => i.checked).length);

function toggle(item) {
    router.patch(route('shopping-list-items.toggle', item.id), {}, { preserveScroll: true });
}

function regenerate() {
    router.post(route('shopping-lists.regenerate', props.list.id), {}, { preserveScroll: true });
}

function sourcesLabel(item) {
    return item.sources
        .map((s) => {
            const amount = s.quantity !== null ? formatAmount(s.quantity, s.unit) : 'to taste';
            const scale = s.scale !== 1 ? ` ×${s.scale}` : '';
            return `${s.recipe}${scale}: ${amount}`;
        })
        .join('\n');
}
</script>

<template>
    <AppLayout>
        <Head :title="list.name || list.label" />

        <Link :href="route('shopping-lists.index')" class="text-sm text-stone-500 hover:text-stone-800">← All lists</Link>

        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-2xl font-semibold">{{ list.name || list.label }}</h1>
                <p v-if="list.name" class="text-sm text-stone-500">{{ list.label }}</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-sm text-stone-500">{{ checkedCount }}/{{ list.items.length }} ticked</span>
                <button
                    type="button"
                    class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
                    title="Rebuild from the calendar (keeps ticked items ticked)"
                    @click="regenerate"
                >
                    ↻ Regenerate
                </button>
            </div>
        </div>

        <div v-if="groups.length" class="mt-6 space-y-6">
            <section v-for="group in groups" :key="group.category">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-stone-400">{{ group.category }}</h2>
                <ul class="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                    <li v-for="item in group.items" :key="item.id">
                        <label class="flex cursor-pointer items-baseline gap-3 px-4 py-2.5" :title="sourcesLabel(item)">
                            <input
                                type="checkbox"
                                :checked="item.checked"
                                class="size-4 translate-y-0.5 rounded border-stone-300 text-green-600 focus:ring-green-500"
                                @change="toggle(item)"
                            />
                            <span :class="{ 'text-stone-400 line-through': item.checked }">
                                <span v-if="item.quantity !== null" class="font-medium tabular-nums">{{ formatAmount(item.quantity, item.unit) }}</span>
                                {{ item.name }}
                            </span>
                            <span v-if="item.sources.length > 1" class="ml-auto shrink-0 text-xs text-stone-400" :title="sourcesLabel(item)">
                                {{ item.sources.length }} recipes
                            </span>
                        </label>
                    </li>
                </ul>
            </section>
        </div>

        <p v-else class="mt-10 text-center text-stone-500">
            Nothing to buy — no recipes are scheduled on the calendar in this date range.
        </p>
    </AppLayout>
</template>
