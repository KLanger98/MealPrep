<script setup>
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

const page = usePage();

const navItems = computed(() => [
    { label: 'Recipes', href: route('recipes.index'), active: page.url.startsWith('/recipes') },
    { label: 'Calendar', href: route('calendar.index'), active: page.url.startsWith('/calendar') },
    { label: 'Shopping Lists', href: route('shopping-lists.index'), active: page.url.startsWith('/shopping-lists') },
]);
</script>

<template>
    <div class="min-h-screen">
        <header class="border-b border-stone-200 bg-white">
            <div class="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
                <Link :href="route('recipes.index')" class="flex items-center gap-2 text-lg font-semibold text-green-700">
                    <span aria-hidden="true">🥘</span>
                    <span>Meal Prep</span>
                </Link>
                <nav class="flex gap-1">
                    <Link
                        v-for="item in navItems"
                        :key="item.label"
                        :href="item.href"
                        class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                        :class="item.active ? 'bg-green-50 text-green-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'"
                    >
                        {{ item.label }}
                    </Link>
                </nav>
            </div>
        </header>

        <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <slot />
        </main>
    </div>
</template>
