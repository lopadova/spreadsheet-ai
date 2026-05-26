<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflows', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->default('demo');
            $table->string('preset_key')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('row_source')->nullable();
            $table->json('columns_config');
            $table->boolean('is_system')->default(false);
            $table->timestamps();

            // One workflow per (tenant, preset_key) — prevents duplicate
            // system/preset workflows under re-seeding or concurrency.
            // (preset_key is nullable; SQLite/Postgres treat NULLs as distinct,
            // so user workflows without a preset_key are unconstrained.)
            $table->unique(['tenant_id', 'preset_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflows');
    }
};
