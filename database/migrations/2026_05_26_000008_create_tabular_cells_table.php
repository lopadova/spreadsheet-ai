<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tabular_cells', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->default('demo');
            $table->foreignId('review_id')->constrained('tabular_reviews')->cascadeOnDelete();
            $table->string('row_id');
            $table->smallInteger('column_index');
            $table->json('content')->nullable();
            $table->string('flag')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('confidence', 3, 2)->nullable();
            $table->dateTime('generated_at')->nullable();
            $table->timestamps();

            $table->unique(['review_id', 'row_id', 'column_index']);
            $table->index(['tenant_id', 'review_id']);
            $table->index(['review_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tabular_cells');
    }
};
