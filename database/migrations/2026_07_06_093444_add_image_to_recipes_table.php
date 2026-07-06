<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Relative path from the recipe file's directory, as written in
            // frontmatter. The sibling-file convention needs no column.
            $table->string('image')->nullable()->after('body_markdown');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('image');
        });
    }
};
