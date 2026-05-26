<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tabular_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->default('demo');
            $table->string('preset_key');
            $table->string('title');
            $table->string('row_source');
            $table->json('columns_config');
            $table->timestamps();

            $table->index('tenant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tabular_reviews');
    }
};
