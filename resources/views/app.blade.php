<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script>
            // Apply the theme before first paint to avoid a flash.
            (() => {
                const theme = localStorage.getItem('theme');
                const dark = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.classList.toggle('dark', dark);
            })();
        </script>
        @routes
        @vite(['resources/js/app.js'])
        @inertiaHead
    </head>
    <body class="bg-stone-50 font-sans text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        @inertia
    </body>
</html>
