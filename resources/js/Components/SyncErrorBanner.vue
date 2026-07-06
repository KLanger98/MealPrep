<script setup>
import { usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const page = usePage();
const dismissed = ref(false);
const errors = computed(() => page.props.syncErrors ?? []);
const expanded = ref(false);
</script>

<template>
    <div v-if="errors.length && !dismissed" class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div class="flex items-center justify-between gap-4">
            <button type="button" class="font-medium underline-offset-2 hover:underline" @click="expanded = !expanded">
                {{ errors.length }} recipe {{ errors.length === 1 ? 'file' : 'files' }} could not be read — {{ expanded ? 'hide' : 'show' }} details
            </button>
            <button type="button" class="text-amber-700 hover:text-amber-900" aria-label="Dismiss" @click="dismissed = true">✕</button>
        </div>
        <ul v-if="expanded" class="mt-2 space-y-1">
            <li v-for="error in errors" :key="error.file + error.message">
                <span class="font-mono font-medium">{{ error.file }}</span>: {{ error.message }}
            </li>
        </ul>
    </div>
</template>
