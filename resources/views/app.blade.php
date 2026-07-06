<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        @routes
        @vite(['resources/js/app.js'])
        @inertiaHead
    </head>
    <body class="bg-stone-50 font-sans text-stone-900 antialiased">
        @inertia
    </body>
</html>
