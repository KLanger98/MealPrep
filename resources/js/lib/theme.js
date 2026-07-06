import { ref } from 'vue';

// 'system' follows the OS; 'light'/'dark' are explicit overrides.
const theme = ref(localStorage.getItem('theme') ?? 'system');

const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
    const dark = theme.value === 'dark' || (theme.value === 'system' && media.matches);
    document.documentElement.classList.toggle('dark', dark);
}

media.addEventListener('change', apply);

export function useTheme() {
    function cycle() {
        theme.value = { system: 'light', light: 'dark', dark: 'system' }[theme.value];

        if (theme.value === 'system') {
            localStorage.removeItem('theme');
        } else {
            localStorage.setItem('theme', theme.value);
        }

        apply();
    }

    return { theme, cycle };
}
