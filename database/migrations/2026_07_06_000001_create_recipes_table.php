<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('type')->default('other')->index();
            $table->string('protein')->nullable()->index();
            $table->string('cost')->nullable()->index();
            $table->unsignedSmallInteger('prep_minutes')->nullable();
            $table->unsignedSmallInteger('cook_minutes')->nullable();
            $table->unsignedSmallInteger('servings')->default(1);
            $table->json('tags')->nullable();
            $table->json('ingredients');
            $table->text('body_markdown')->nullable();
            $table->json('meta')->nullable();
            $table->string('file_path');
            $table->unsignedBigInteger('file_mtime');
            $table->string('file_hash', 32);
            $table->timestamp('missing_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipes');
    }
};
