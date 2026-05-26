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

            $table->index('tenant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflows');
    }
};
