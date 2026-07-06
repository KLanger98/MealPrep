<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import AssignmentCard from '@/Components/AssignmentCard.vue';
import AssignmentModal from '@/Components/AssignmentModal.vue';
import SyncErrorBanner from '@/Components/SyncErrorBanner.vue';
import { Head, router } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    weekStart: { type: String, required: true },
    days: { type: Array, required: true },
    slots: { type: Array, required: true },
    assignments: { type: Array, required: true },
    recipeOptions: { type: Array, required: true },
});

// date -> slot -> assignments
const grid = computed(() => {
    const map = {};
    for (const a of props.assignments) {
        ((map[a.date] ??= {})[a.slot] ??= []).push(a);
    }
    return map;
});

const modalOpen = ref(false);
const modalContext = ref({});

function openAdd(date, slot) {
    modalContext.value = { date, slot };
    modalOpen.value = true;
}

function openEdit(assignment) {
    modalContext.value = { assignment };
    modalOpen.value = true;
}

function goToWeek(offsetDays) {
    const date = new Date(props.weekStart + 'T00:00:00');
    date.setDate(date.getDate() + offsetDays);
    // Format in local time — toISOString() converts to UTC, which rolls the
    // date back a day in timezones ahead of UTC and breaks week navigation.
    const week = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    router.get(route('calendar.index'), { week }, { preserveState: false });
}

function goToToday() {
    router.get(route('calendar.index'));
}

const weekLabel = computed(() => {
    const start = new Date(props.weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const opts = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', { ...opts, year: 'numeric' })}`;
});
</script>

<template>
    <AppLayout>
        <Head title="Calendar" />
        <SyncErrorBanner />

        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-semibold">Calendar</h1>
            <div class="flex items-center gap-2">
                <span class="mr-2 text-sm text-stone-500">{{ weekLabel }}</span>
                <button type="button" class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50" @click="goToWeek(-7)">←</button>
                <button type="button" class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50" @click="goToToday">Today</button>
                <button type="button" class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50" @click="goToWeek(7)">→</button>
            </div>
        </div>

        <div class="mt-6 overflow-x-auto">
            <div class="grid min-w-[900px] grid-cols-[70px_repeat(7,1fr)] gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200">
                <div class="bg-stone-50 p-2"></div>
                <div
                    v-for="day in days"
                    :key="day.date"
                    class="bg-stone-50 p-2 text-center"
                    :class="{ 'bg-green-50': day.isToday }"
                >
                    <div class="text-xs font-medium uppercase tracking-wide text-stone-500">{{ day.dayName }}</div>
                    <div class="text-sm font-semibold" :class="day.isToday ? 'text-green-700' : 'text-stone-800'">{{ day.dayNumber }}</div>
                </div>

                <template v-for="slot in slots" :key="slot">
                    <div class="flex items-start bg-stone-50 p-2">
                        <span class="text-xs font-medium uppercase tracking-wide text-stone-500">{{ slot }}</span>
                    </div>
                    <div
                        v-for="day in days"
                        :key="slot + day.date"
                        class="group/cell min-h-24 space-y-1.5 bg-white p-1.5"
                        :class="{ 'bg-green-50/40': day.isToday }"
                    >
                        <AssignmentCard
                            v-for="assignment in grid[day.date]?.[slot] ?? []"
                            :key="assignment.id"
                            :assignment="assignment"
                            @edit="openEdit"
                        />
                        <button
                            type="button"
                            class="w-full rounded-md border border-dashed border-stone-200 py-1 text-xs text-stone-300 opacity-0 transition-opacity hover:border-green-400 hover:text-green-600 group-hover/cell:opacity-100"
                            @click="openAdd(day.date, slot)"
                        >
                            + Add
                        </button>
                    </div>
                </template>
            </div>
        </div>

        <AssignmentModal
            :show="modalOpen"
            :recipes="recipeOptions"
            :slots="slots"
            :context="modalContext"
            @close="modalOpen = false"
        />
    </AppLayout>
</template>
