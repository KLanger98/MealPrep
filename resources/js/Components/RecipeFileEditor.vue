<script setup>
defineProps({
    modelValue: { type: String, required: true },
    error: { type: String, default: null },
    processing: { type: Boolean, default: false },
    submitLabel: { type: String, default: 'Save' },
});

const emit = defineEmits(['update:modelValue', 'submit']);
</script>

<template>
    <form @submit.prevent="emit('submit')">
        <div v-if="error" class="mb-3 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ error }}
        </div>

        <textarea
            :value="modelValue"
            rows="26"
            spellcheck="false"
            class="w-full rounded-xl border border-stone-300 bg-white p-4 font-mono text-sm leading-relaxed focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            @input="emit('update:modelValue', $event.target.value)"
        ></textarea>

        <div class="mt-3 flex items-center justify-between gap-4">
            <p class="text-xs text-stone-500">
                YAML frontmatter + Markdown method — the format is documented in
                <span class="font-mono">recipes/SCHEMA.md</span>.
            </p>
            <button
                type="submit"
                class="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                :disabled="processing"
            >
                {{ submitLabel }}
            </button>
        </div>
    </form>
</template>
